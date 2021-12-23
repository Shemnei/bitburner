.PHONY: check serve

check:
	tsc

serve:
	python3 -m http.server --directory src/ 8080
