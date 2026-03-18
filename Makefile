LATEXMK=latexmk
MAIN=main.tex

.PHONY: all pdf clean

all: pdf

pdf:
	$(LATEXMK) -xelatex -interaction=nonstopmode -halt-on-error $(MAIN)

clean:
	$(LATEXMK) -C
