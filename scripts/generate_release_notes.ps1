param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [string]$CurrentRef = 'HEAD',

    [string]$BaseRef,

    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-Git {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $quotedArgs = $Args | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        } else {
            $_
        }
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'git'
    $psi.Arguments = ($quotedArgs -join ' ')
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            throw $stderr.Trim()
        }
        throw "git command failed: git $($Args -join ' ')"
    }

    if ([string]::IsNullOrWhiteSpace($stdout)) {
        return @()
    }

    return ($stdout -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-GitRef {
    param([string]$Ref)
    try {
        Invoke-Git rev-parse --verify --quiet $Ref *> $null
        return $true
    } catch {
        return $false
    }
}

function Get-ChangedPathFromStatusLine {
    param([string]$Line)
    $parts = $Line -split "`t"
    if ($parts.Count -ge 3 -and $parts[0] -match '^R\d+$') {
        return $parts[2]
    }
    return $parts[-1]
}

function Get-ChapterTitle {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return [System.IO.Path]::GetFileNameWithoutExtension($Path)
    }

    $content = Get-Content -LiteralPath $Path -Encoding UTF8
    foreach ($line in $content) {
        if ($line -match '\\chapter(?:\[[^\]]*\])?\{(.+)\}') {
            return $matches[1]
        }
    }
    return [System.IO.Path]::GetFileNameWithoutExtension($Path)
}

function Get-Category {
    param([string]$Path)
    switch -Wildcard ($Path) {
        'chapters/*'          { return '正文章节' }
        'frontmatter/*'       { return '前置页' }
        'code/*'              { return '代码与算例' }
        'review/*'            { return '审稿与计划' }
        'reference/*'         { return '参考资料' }
        'scripts/*'           { return '脚本与自动化' }
        'preamble.tex'        { return '导言与版式' }
        'notation.tex'        { return '符号与术语' }
        'refs.bib'            { return '参考文献' }
        'README.md'           { return '项目说明' }
        'WRITING_GUIDE.md'    { return '写作指南' }
        'GIT_WORKFLOW.md'     { return 'Git 工作流' }
        default               { return '其他文件' }
    }
}

function New-EntryMapFromDiff {
    param(
        [string[]]$StatusLines,
        [string[]]$NumstatLines
    )

    $map = @{}

    foreach ($line in $StatusLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $path = Get-ChangedPathFromStatusLine $line
        if (-not $map.ContainsKey($path)) {
            $map[$path] = [pscustomobject][ordered]@{
                Path = $path
                Status = ($line -split "`t")[0]
                Added = 0
                Deleted = 0
                Category = Get-Category $path
            }
        }
    }

    foreach ($line in $NumstatLines) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split "`t"
        if ($parts.Count -lt 3) { continue }
        $path = $parts[-1]
        if (-not $map.ContainsKey($path)) {
            $map[$path] = [pscustomobject][ordered]@{
                Path = $path
                Status = 'M'
                Added = 0
                Deleted = 0
                Category = Get-Category $path
            }
        }
        $map[$path].Added = if ($parts[0] -eq '-') { 0 } else { [int]$parts[0] }
        $map[$path].Deleted = if ($parts[1] -eq '-') { 0 } else { [int]$parts[1] }
    }

    return @($map.Values)
}

function New-EntryMapFromWorktree {
    $entries = @()

    $diffStatus = Invoke-Git diff --name-status HEAD
    $diffNumstat = Invoke-Git diff --numstat HEAD
    $entries += New-EntryMapFromDiff -StatusLines $diffStatus -NumstatLines $diffNumstat

    $trackedPaths = @{}
    foreach ($entry in $entries) {
        $trackedPaths[$entry.Path] = $true
    }

    $untracked = Invoke-Git ls-files --others --exclude-standard
    foreach ($path in $untracked) {
        if (-not $trackedPaths.ContainsKey($path)) {
            $entries += [pscustomobject][ordered]@{
                Path = $path
                Status = '??'
                Added = 0
                Deleted = 0
                Category = Get-Category $path
            }
        }
    }

    return $entries
}

function Add-EntrySection {
    param(
        [System.Text.StringBuilder]$Builder,
        [object[]]$Entries,
        [string]$Heading
    )

    if (-not $Entries -or $Entries.Count -eq 0) {
        return
    }

    [void]$Builder.AppendLine("## $Heading")
    [void]$Builder.AppendLine()

    $groups = $Entries | Group-Object { Get-Category $_.Path } | Sort-Object Name
    foreach ($group in $groups) {
        [void]$Builder.AppendLine("### $($group.Name)")
        foreach ($entry in ($group.Group | Sort-Object Path)) {
            if ($entry.Path -like 'chapters/*') {
                $title = Get-ChapterTitle $entry.Path
                $label = Split-Path $entry.Path -Leaf
                $counts = "+$($entry.Added) / -$($entry.Deleted)"
                [void]$Builder.AppendLine("- " + '`' + $label + '`' + "：《$title》 (" + '`' + $counts + '`' + ")")
            } else {
                $counts = "+$($entry.Added) / -$($entry.Deleted)"
                [void]$Builder.AppendLine("- " + '`' + $entry.Path + '`' + " (" + '`' + $counts + '`' + ")")
            }
        }
        [void]$Builder.AppendLine()
    }
}

if (-not $OutputPath) {
    $safeVersion = ($Version -replace '[^0-9A-Za-z._-]', '_')
    $OutputPath = Join-Path 'build' ("release_notes_{0}.auto.md" -f $safeVersion)
}

if (-not $BaseRef) {
    $tags = @(Invoke-Git tag --sort=-creatordate)
    foreach ($tag in $tags) {
        if ($tag -and $tag -ne $CurrentRef) {
            $BaseRef = $tag
            break
        }
    }
}

if (-not $BaseRef) {
    throw '无法自动推断 BaseRef，请显式传入 -BaseRef。'
}

if (-not (Test-GitRef $BaseRef)) {
    throw "BaseRef 不存在：$BaseRef"
}

if ($CurrentRef -ne 'HEAD' -and -not (Test-GitRef $CurrentRef)) {
    throw "CurrentRef 不存在：$CurrentRef"
}

$rangeStatus = Invoke-Git diff --name-status "$BaseRef..$CurrentRef"
$rangeNumstat = Invoke-Git diff --numstat "$BaseRef..$CurrentRef"
$rangeEntries = @(New-EntryMapFromDiff -StatusLines $rangeStatus -NumstatLines $rangeNumstat)

$worktreeEntries = @()
if ($CurrentRef -eq 'HEAD') {
    $worktreeEntries = @(New-EntryMapFromWorktree)
}

$commits = @(Invoke-Git log --pretty=format:%s "$BaseRef..$CurrentRef")
$categorySummary = @($rangeEntries | Group-Object { Get-Category $_.Path } | Sort-Object Count -Descending | Select-Object -First 3)
if ($categorySummary.Count -gt 0) {
    $summaryText = ($categorySummary | ForEach-Object { "{0}（{1} 个文件）" -f $_.Name, $_.Count }) -join '、'
} else {
    $summaryText = '当前比较范围内没有已提交改动'
}

$builder = New-Object System.Text.StringBuilder
[void]$builder.AppendLine("# PCSELbook $Version")
[void]$builder.AppendLine()
[void]$builder.AppendLine("- 比较范围：" + '`' + "$BaseRef -> $CurrentRef" + '`')
[void]$builder.AppendLine("- 已提交改动文件数：" + '`' + "$($rangeEntries.Count)" + '`')
[void]$builder.AppendLine("- 主要集中在：$summaryText")
[void]$builder.AppendLine()

if ($commits.Count -gt 0) {
    [void]$builder.AppendLine('## 提交记录摘要')
    [void]$builder.AppendLine()
    foreach ($subject in $commits) {
        [void]$builder.AppendLine("- $subject")
    }
    [void]$builder.AppendLine()
}

[void]$builder.AppendLine('## 自动摘要')
[void]$builder.AppendLine()
[void]$builder.AppendLine('这是一份基于 `git diff` 与当前工作区生成的 release 说明草稿。正式发布前应人工收紧措辞，并突出最关键的理论、结构或工作流改动。')
[void]$builder.AppendLine()

Add-EntrySection -Builder $builder -Entries $rangeEntries -Heading "已提交改动（$BaseRef..$CurrentRef）"
Add-EntrySection -Builder $builder -Entries $worktreeEntries -Heading '工作区尚未提交但已保存的改动（相对 HEAD）'

[void]$builder.AppendLine('## 推荐整理成正式 Release Notes 的方式')
[void]$builder.AppendLine()
[void]$builder.AppendLine('1. 先写本版本主要解决了哪条章节主链或工作流问题。')
[void]$builder.AppendLine('2. 再写新增或强化了哪些关键公式、图、判据、接口表。')
[void]$builder.AppendLine('3. 若涉及脚本、工作流、Git 或 release 约定，也单列说明。')
[void]$builder.AppendLine('4. 最后说明本 release 上传的 PDF 来自当前源码状态下编译得到的 `build/pcselbook.pdf`。')
[void]$builder.AppendLine()

$dir = Split-Path -Parent $OutputPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
}

Set-Content -LiteralPath $OutputPath -Value $builder.ToString() -Encoding UTF8
Write-Output "Generated: $OutputPath"
