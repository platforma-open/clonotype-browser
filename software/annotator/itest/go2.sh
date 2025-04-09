#!/usr/bin/env bash

python ../src/main.py \
    --clonotype-data example2/clonotype_properties.tsv \
    --clonotype-schema example2/clonotype_properties_schema.json \
    --sample-clonotype-data example2/sample_clonotype_properties.tsv \
    --sample-clonotype-schema example2/sample_clonotype_properties_schema.json \
    --script example2/script.json \
    --output example2/output.tsv
