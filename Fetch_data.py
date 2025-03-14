import json
import requests
import pandas as pd
import os
import time
from datetime import datetime
import io

def extract_site_ids(json_file):
    """Extract site IDs from the JSON file"""
    with open(json_file, 'r') as f:
        data = json.load(f)

    site_ids = [site['id'] for site in data if 'id' in site]
    return site_ids

def construct_api_url(site_id, params, start_date, end_date):
    """Construct the API URL with the given parameters"""
    params_str = ','.join(params)
    url = f"http://atmos.urbansciences.in/adp/v4/getDeviceDataParam/imei/{site_id}/params/{params_str}/startdate/{start_date}/enddate/{end_date}/ts/mm/avg/15/api/63h3AckbgtY?gaps=1&gap_value=NaN"
    return url

def fetch_data_as_csv(url, max_retries=3):
    """Fetch data from the API expecting CSV response format"""
    headers = {
        'Accept': '*/*',  # Accept any content type
        'User-Agent': 'Python/3.x Data Collection Script'
    }

    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)

            # Check if the request was successful
            response.raise_for_status()

            # Log response info for debugging
            content_type = response.headers.get('Content-Type', 'unknown')
            print(f"Response status: {response.status_code}")
            print(f"Response content type: {content_type}")
            print(f"Response length: {len(response.text)} bytes")

            # Check if response is empty
            if not response.text.strip():
                print("Empty response received")
                return None

            # If response is CSV, parse directly to DataFrame
            if 'application/csv' in content_type or 'text/csv' in content_type or response.text.strip().startswith('dt_time,'):
                print("Detected CSV format response")
                try:
                    # Use pandas to parse the CSV data
                    df = pd.read_csv(io.StringIO(response.text))
                    print(f"Successfully parsed CSV data with {len(df)} rows")
                    return df
                except Exception as e:
                    print(f"Error parsing CSV data: {e}")
                    # Save problematic response for inspection
                    error_file = f"error_response_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    with open(error_file, 'w') as f:
                        f.write(response.text)
                    print(f"Saved error response to {error_file}")
                    return None

            # If JSON content type or if we can't determine, try to parse as JSON
            try:
                data = response.json()
                # Check if response indicates an error
                if isinstance(data, dict) and 'message' in data and data.get('message') == 'unsuccessful':
                    error_msg = data.get('error', 'Unknown error')
                    print(f"API returned error: {error_msg}")
                    return None
                return data
            except ValueError:
                # Not JSON, try to parse as CSV as a fallback
                try:
                    df = pd.read_csv(io.StringIO(response.text))
                    print(f"Successfully parsed as CSV (fallback) with {len(df)} rows")
                    return df
                except Exception as csv_err:
                    print(f"Failed to parse response as JSON or CSV: {csv_err}")
                    # Save problematic response
                    error_file = f"error_response_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
                    with open(error_file, 'w') as f:
                        f.write(response.text)
                    print(f"Saved error response to {error_file}")
                    return None

        except requests.exceptions.RequestException as e:
            print(f"Attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                wait_time = 2 * (attempt + 1)  # Exponential backoff
                print(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"Failed to fetch data after {max_retries} attempts")
                return None

def main():
    # Configuration
    json_file = 'site_ids.json'
    params = ["pm2.5cnc", "pm10cnc"]  # Parameters to fetch

    # Date range - full range as specified
    start_date = "2023-12-29T00:00"
    end_date = "2024-12-31T00:00"

    # Create output directory
    output_dir = 'air_quality_data'
    os.makedirs(output_dir, exist_ok=True)

    # Get site IDs from JSON file
    site_ids = extract_site_ids(json_file)
    print(f"Found {len(site_ids)} site IDs")

    # Dictionary to store DataFrames for each site
    site_data = {}
    successful_sites = 0
    failed_sites = 0

    # Process each site ID
    for i, site_id in enumerate(site_ids):
        print(f"\nProcessing site {i+1}/{len(site_ids)}: {site_id}")

        # Construct API URL
        url = construct_api_url(site_id, params, start_date, end_date)
        print(f"URL: {url}")

        # Fetch data (expecting CSV format)
        data = fetch_data_as_csv(url)

        if data is not None:
            if isinstance(data, pd.DataFrame):
                # Ensure 'site_id' column exists
                if 'deviceid' not in data.columns:
                    data['deviceid'] = site_id

                # Store the DataFrame
                site_data[site_id] = data
                successful_sites += 1

                # Just log the number of rows collected
                print(f"Collected {len(data)} rows of data for {site_id}")
            else:
                print(f"Unexpected data type for {site_id}: {type(data)}")
                failed_sites += 1
        else:
            print(f"No data retrieved for {site_id}")
            failed_sites += 1

        # Wait between requests to avoid overwhelming the API
        if i < len(site_ids) - 1:  # Don't wait after the last request
            time.sleep(1)

    # Create combined dataset if we have data
    if site_data:
        # Combine all dataframes
        all_data = pd.concat(site_data.values(), ignore_index=True)

        # Save to a single CSV file
        output_file = f"{output_dir}/air_quality_data.csv"
        all_data.to_csv(output_file, index=False)

        print(f"\nSummary:")
        print(f"Total sites processed: {len(site_ids)}")
        print(f"Successful sites: {successful_sites}")
        print(f"Failed sites: {failed_sites}")
        print(f"Total rows collected: {len(all_data)}")
        print(f"All data saved to: {output_file}")
    else:
        print("\nNo data was collected from any site.")

if __name__ == "__main__":
    main()
