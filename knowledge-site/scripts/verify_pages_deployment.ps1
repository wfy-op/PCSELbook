$ErrorActionPreference = 'Stop'

$baseUrl = 'https://pcsel-knowledge-site.pages.dev'
$checks = @(
    @{ Name = 'home'; Url = "$baseUrl/"; Contains = 'static-chapter' },
    @{ Name = 'chapter'; Url = "$baseUrl/chapters/ch03-maxwell-periodic-media/"; Contains = 'data-static-fallback' },
    @{ Name = 'chapter-data'; Url = "$baseUrl/data/chapters/ch03-maxwell-periodic-media.json"; Contains = 'class=\"katex' },
    @{ Name = 'figure'; Url = "$baseUrl/figures/010-fig-ch03_boundary_conditions.webp"; Contains = $null },
    @{ Name = 'pdf'; Url = "$baseUrl/book.pdf"; Contains = $null }
)

$results = foreach ($check in $checks) {
    $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing
    if ($response.StatusCode -ne 200) {
        throw "$($check.Name) returned HTTP $($response.StatusCode)"
    }
    if ($check.Contains -and -not $response.Content.Contains($check.Contains)) {
        throw "$($check.Name) is missing expected content: $($check.Contains)"
    }
    [PSCustomObject]@{
        Name = $check.Name
        Status = $response.StatusCode
        Type = $response.Headers['Content-Type']
        Bytes = $response.RawContentLength
    }
}

$homeResponse = Invoke-WebRequest -Uri "$baseUrl/" -UseBasicParsing
foreach ($header in @('Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy')) {
    if (-not $homeResponse.Headers[$header]) {
        throw "Missing expected response header: $header"
    }
}

$chapterData = (Invoke-WebRequest -Uri "$baseUrl/data/chapters/ch03-maxwell-periodic-media.json" -UseBasicParsing).Content
if ($chapterData.Contains('class=\"math-source')) {
    throw 'Chapter data still contains unrendered math-source elements.'
}

$results | Format-Table -AutoSize
Write-Output 'Cloudflare Pages verification passed.'
