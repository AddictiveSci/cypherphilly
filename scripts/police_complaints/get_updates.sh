#!/bin/bash

API_URL='https://phl.carto.com/api/v2/sql?q=SELECT%20*%20FROM%20ppd_complaints'

curl $API_URL | jq -c '.rows | .[] | {cartodb_id: .cartodb_id, the_geom: .the_geom, the_geom_webmercator: .the_geom_webmercator, cap_number: .cap_number, date_received: .date_received, dist_occurrence: .dist_occurrence, general_cap_classification: .general_cap_classification, summary: .summary}'