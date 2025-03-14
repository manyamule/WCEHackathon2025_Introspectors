import json
import requests
import pandas as pd
import os
from datetime import datetime
import io

# Load site IDs from site_ids.json
def load_site_ids(json_file):
    with open(json_file, 'r') as f:
        data = json.load(f)
    site_ids = [site['id'] for site in data if 'id' in site]
    return site_ids

# Construct API URL
def construct_api_url(site_id, params, start_date, end_date):
    params_str = ",".join(params)
    url = f"http://atmos.urbansciences.in/adp/v4/getDeviceDataParam/imei/{site_id}/params/{params_str}/startdate/{start_date}/enddate/{end_date}/ts/mm/avg/15/api/63h3AckbgtY?gaps=1&gap_value=NaN"
    return url

# Fetch data from API
def fetch_data(api_url):
    headers = {'Accept': 'text/csv'}
    try:
        response = requests.get(api_url, headers=headers, timeout=30)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx, 5xx)
        
        if not response.text.strip():  # Handle empty responses
            print("Empty response from API")
            return None

        # Use io.StringIO for CSV parsing
        return pd.read_csv(io.StringIO(response.text))
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None
    except pd.errors.EmptyDataError:
        print("No data to parse in CSV response.")
        return None

# Store data to CSV
def save_data(df, site_id, output_dir='data'):
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, f"{site_id}_data.csv")
    df.to_csv(file_path, index=False)
    print(f"Data saved to {file_path}")

# Main function
def main(json_file, start_date, end_date, params=["pm2.5cnc", "pm10cnc"]):
    site_ids = load_site_ids(json_file)
    print(f"Found {len(site_ids)} site IDs.")
    
    for site_id in site_ids:
        print(f"Fetching data for site ID: {site_id}")
        api_url = construct_api_url(site_id, params, start_date, end_date)
        data = fetch_data(api_url)
        
        if data is not None and not data.empty:
            save_data(data, site_id)
        else:
            print(f"No data retrieved for site ID: {site_id}")

# Set parameters
json_file = 'site_ids.json'
start_date = '2023-12-29T00:00'
end_date = '2024-12-31T00:00'

# Run the script
if __name__ == "__main__":
    main(json_file, start_date, end_date)
