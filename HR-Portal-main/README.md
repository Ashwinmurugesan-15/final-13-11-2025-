# Excel Data Manager Web Application

A web application for managing and analyzing data stored in Excel files.

## Features

- **Data Management**: View, add, edit, and delete records in Excel files
- **Data Analysis**: Statistical summaries and visualizations
- **Group Analysis**: Analyze data grouped by categorical columns
- **Data Distribution**: Visualize data distribution with histograms

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Run the application:
   ```
   python app.py
   ```
2. Open your browser and navigate to http://localhost:5000
3. The application will automatically create a sample Excel file (data.xlsx) on first run

## Project Structure

- `app.py`: Flask backend with API endpoints
- `templates/index.html`: Main HTML template
- `static/js/app.js`: Frontend JavaScript code
- `data.xlsx`: Excel file used as database (created automatically)

## API Endpoints

- `GET /api/data`: Get all records
- `POST /api/data`: Add a new record
- `PUT /api/data/<id>`: Update a record
- `DELETE /api/data/<id>`: Delete a record
- `GET /api/analysis/summary`: Get statistical summary
- `GET /api/analysis/group/<column>`: Get group analysis by column

## Requirements

- Python 3.6+
- Flask
- Pandas
- Openpyxl
- Matplotlib
- NumPy