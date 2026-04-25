LATEXMK=latexmk
MAIN=main.tex
OUTDIR=build
JOBNAME=pcselbook

.PHONY: all pdf clean

all: pdf

pdf:
	$(LATEXMK) -xelatex -interaction=nonstopmode -halt-on-error -outdir=$(OUTDIR) -jobname=$(JOBNAME) $(MAIN)

clean:
	$(LATEXMK) -C -outdir=$(OUTDIR) -jobname=$(JOBNAME) $(MAIN)
