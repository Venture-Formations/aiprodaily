#!/bin/bash

echo "Testing Google Vision API after billing enabled..."
echo "=========================================="

# Test 1: Configuration check
echo "1. Testing configuration..."
curl -s "http://localhost:3000/api/debug/test-google-vision?image_url=https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800" | jq .

echo ""
echo "2. If that worked, test with a stock photo..."
curl -s "http://localhost:3000/api/debug/test-google-vision?image_url=https://www.shutterstock.com/image-photo/business-meeting-260nw-1234567890.jpg" | jq .

echo ""
echo "Testing complete!"