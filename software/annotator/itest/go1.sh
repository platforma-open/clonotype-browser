#!/usr/bin/env bash

python ../src/main.py \
    --clonotype-data test_1_clonotype_properties.tsv \
    --clonotype-schema test_1_clonotype_properties_schema.json \
    --script test_1_script.json \
    --output test_1_output.tsv 
