import csv
import json

# Define input and output file paths
csv_files = {
    'travellist1': 'Travellist1-web.csv',
    'travellist2': 'Travellist2-web.csv',
    'countries': 'Countries-web.csv',
    'animals': 'Animals-web.csv'
}

json_files = {
    'travellist1': 'data/travellist1.json',
    'travellist2': 'data/travellist2.json',
    'countries': 'data/countries.json',
    'animals': 'data/animals.json'
}

# Function to convert CSV to JSON
def convert_csv_to_json(csv_filename, json_filename, fields):
    with open(csv_filename, mode='r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        data = []
        for row in reader:
            # Skip header/summary rows by checking if necessary fields are filled
            if any(row[field] for field in fields):
                item = {key: (True if row[key] == '?' else (False if row[key] in ('', '0') else row[key])) for key in fields}
                data.append(item)
        # Write to JSON file
        with open(json_filename, mode='w', encoding='utf-8') as jsonfile:
            json.dump(data, jsonfile, ensure_ascii=False, indent=4)

# Fields for each file
travellist_fields = ['ranking', 'destination', 'country', 'continent', 'value', 'paul', 'ruth', 'ben', 'shaz']
country_fields = ['continent', 'country', 'capital', 'paul', 'ruth', 'ben', 'shaz']
animal_fields = ['majorGroup', 'subGroup', 'species', 'continents', 'paul', 'ruth', 'ben', 'shaz']

# Convert each CSV to JSON
convert_csv_to_json(csv_files['travellist1'], json_files['travellist1'], travellist_fields)
convert_csv_to_json(csv_files['travellist2'], json_files['travellist2'], travellist_fields)
convert_csv_to_json(csv_files['countries'], json_files['countries'], country_fields)
convert_csv_to_json(csv_files['animals'], json_files['animals'], animal_fields)