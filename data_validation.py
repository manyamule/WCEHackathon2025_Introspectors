import pandas as pd
import os

# Path to data folder
data_dir = 'data'

# List all CSV files
csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
print(f"Found {len(csv_files)} CSV files.")

# Clean and validate each CSV
for file in csv_files:
    file_path = os.path.join(data_dir, file)
    print(f"\nProcessing {file}...")

    # Load CSV
    df = pd.read_csv(file_path)

    # Convert dt_time to datetime and set as index
    if 'dt_time' in df.columns:
        df['dt_time'] = pd.to_datetime(df['dt_time'], errors='coerce')
        df.set_index('dt_time', inplace=True)
    else:
        print(f"Skipping {file} — 'dt_time' column not found.")
        continue

    # Handle full-column missing values
    if df['pm2.5cnc'].isnull().all():
        print(f"Warning: All values missing for 'pm2.5cnc' in {file}. Imputing with median...")
        df['pm2.5cnc'].fillna(df['pm2.5cnc'].median(), inplace=True)

    if df['pm10cnc'].isnull().all():
        print(f"Warning: All values missing for 'pm10cnc' in {file}. Imputing with median...")
        df['pm10cnc'].fillna(df['pm10cnc'].median(), inplace=True)

    # Forward and backward fill
    df.loc[:, 'pm2.5cnc'] = df['pm2.5cnc'].ffill().bfill()
    df.loc[:, 'pm10cnc'] = df['pm10cnc'].ffill().bfill()

    # Interpolation (time-based)
    df.loc[:, 'pm2.5cnc'] = df['pm2.5cnc'].interpolate(method='time')
    df.loc[:, 'pm10cnc'] = df['pm10cnc'].interpolate(method='time')

    # Save cleaned data
    output_path = os.path.join(data_dir, f"final_cleaned_{file}")
    df.reset_index().to_csv(output_path, index=False)
    print(f"Cleaned data saved to {output_path}")

    # Check for remaining missing values
    print("\nRemaining missing values after cleaning:")
    print(df.isnull().sum())
