-- Populate Weather Forecasts database with sample data
-- Run this script in your Supabase SQL Editor

-- First, check if weather_forecasts table exists and what data is already there
SELECT COUNT(*) as current_count FROM weather_forecasts;

-- Insert sample weather forecast data for the next 7 days
-- Each forecast contains 3 days of weather data starting from the forecast date
-- Note: html_content and image_url are required fields, so we'll populate them with basic values

INSERT INTO weather_forecasts (forecast_date, weather_data, html_content, image_url) VALUES
  ('2025-09-24', '[
    {"day": "TODAY", "dateLabel": "Sep 24", "icon": "sunny", "precipitation": 0, "high": 74, "low": 54, "condition": "Widespread Fog then Mostly Sunny"},
    {"day": "TOMORROW", "dateLabel": "Sep 25", "icon": "sunny", "precipitation": 0, "high": 80, "low": 53, "condition": "Areas Of Fog then Sunny"},
    {"day": "FRIDAY", "dateLabel": "Sep 26", "icon": "sunny", "precipitation": 0, "high": 80, "low": 55, "condition": "Sunny"}
  ]', '<div class="weather-forecast">3-day forecast: Sunny conditions, highs 74-80°F</div>', 'https://raw.githubusercontent.com/VFDavid/st-cloud-scoop/main/weather-images/weather-2025-09-23.png'),
  ('2025-09-25', '[
    {"day": "Wednesday", "dateLabel": "Sep 25", "icon": "sunny", "precipitation": 5, "high": 75, "low": 61},
    {"day": "Thursday", "dateLabel": "Sep 26", "icon": "cloudy", "precipitation": 25, "high": 68, "low": 55},
    {"day": "Friday", "dateLabel": "Sep 27", "icon": "rain", "precipitation": 65, "high": 64, "low": 52}
  ]', '<div class="weather-forecast">3-day forecast: Sunny to rainy, highs 64-75°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast'),
  ('2025-09-26', '[
    {"day": "Thursday", "dateLabel": "Sep 26", "icon": "cloudy", "precipitation": 25, "high": 68, "low": 55},
    {"day": "Friday", "dateLabel": "Sep 27", "icon": "rain", "precipitation": 65, "high": 64, "low": 52},
    {"day": "Saturday", "dateLabel": "Sep 28", "icon": "partly-cloudy-day", "precipitation": 20, "high": 69, "low": 56}
  ]', '<div class="weather-forecast">3-day forecast: Cloudy to partly cloudy, highs 64-69°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast'),
  ('2025-09-27', '[
    {"day": "Friday", "dateLabel": "Sep 27", "icon": "rain", "precipitation": 65, "high": 64, "low": 52},
    {"day": "Saturday", "dateLabel": "Sep 28", "icon": "partly-cloudy-day", "precipitation": 20, "high": 69, "low": 56},
    {"day": "Sunday", "dateLabel": "Sep 29", "icon": "sunny", "precipitation": 10, "high": 73, "low": 59}
  ]', '<div class="weather-forecast">3-day forecast: Rainy to sunny, highs 64-73°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast'),
  ('2025-09-28', '[
    {"day": "Saturday", "dateLabel": "Sep 28", "icon": "partly-cloudy-day", "precipitation": 20, "high": 69, "low": 56},
    {"day": "Sunday", "dateLabel": "Sep 29", "icon": "sunny", "precipitation": 10, "high": 73, "low": 59},
    {"day": "Monday", "dateLabel": "Sep 30", "icon": "cloudy", "precipitation": 30, "high": 67, "low": 54}
  ]', '<div class="weather-forecast">3-day forecast: Partly cloudy to cloudy, highs 67-73°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast'),
  ('2025-09-29', '[
    {"day": "Sunday", "dateLabel": "Sep 29", "icon": "sunny", "precipitation": 10, "high": 73, "low": 59},
    {"day": "Monday", "dateLabel": "Sep 30", "icon": "cloudy", "precipitation": 30, "high": 67, "low": 54},
    {"day": "Tuesday", "dateLabel": "Oct 1", "icon": "partly-cloudy-day", "precipitation": 15, "high": 71, "low": 57}
  ]', '<div class="weather-forecast">3-day forecast: Sunny to partly cloudy, highs 67-73°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast'),
  ('2025-09-30', '[
    {"day": "Monday", "dateLabel": "Sep 30", "icon": "cloudy", "precipitation": 30, "high": 67, "low": 54},
    {"day": "Tuesday", "dateLabel": "Oct 1", "icon": "partly-cloudy-day", "precipitation": 15, "high": 71, "low": 57},
    {"day": "Wednesday", "dateLabel": "Oct 2", "icon": "sunny", "precipitation": 5, "high": 74, "low": 60}
  ]', '<div class="weather-forecast">3-day forecast: Cloudy to sunny, highs 67-74°F</div>', 'https://via.placeholder.com/600x300/87CEEB/000000?text=Weather+Forecast')
ON CONFLICT (forecast_date) DO NOTHING;

-- Check final count
SELECT COUNT(*) as final_count FROM weather_forecasts;

-- Show recent entries with basic info
SELECT
  forecast_date,
  jsonb_array_length(weather_data) as days_count,
  weather_data->0->>'day' as first_day,
  weather_data->0->>'high' as first_day_high,
  weather_data->0->>'icon' as first_day_icon
FROM weather_forecasts
ORDER BY forecast_date DESC
LIMIT 10;