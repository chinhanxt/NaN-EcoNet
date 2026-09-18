python3 -m src.experiment.sensitivity --instance-file <file> --parameters <params.yaml> --output sens.csv
python3 -m src.experiment.scalability --instance-file <file> --parameters <params.yaml> --output scale.csv
python3 -m src.experiment.speedup --instance-file <file> --parameters <params.yaml> --output speedup.csv

# Backwards-compatible dispatcher:
python3 -m src.experiment.analysis --experiment sensitivity ...