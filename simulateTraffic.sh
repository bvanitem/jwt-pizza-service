#!/bin/bash

# Base URL for the service
BASE_URL="http://localhost:3000"

# Function to print section headers
print_section() {
  echo "========================================"
  echo "$1"
  echo "========================================"
}

# Function to make a curl request and print the response
make_request() {
  local method="$1"
  local url="$2"
  local headers="$3"
  local data="$4"
  echo "Request: $method $url"
  if [ -n "$headers" ]; then
    echo "Headers: $headers"
  fi
  if [ -n "$data" ]; then
    echo "Data: $data"
  fi
  response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X "$method" "$url" $headers -d "$data")
  body=$(echo "$response" | sed -e 's/HTTP_STATUS:[0-9]*$//')
  status=$(echo "$response" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
  echo "Response (Status $status): $body"
  echo "----------------------------------------"
}

# Step 1: Unauthenticated Requests
print_section "Unauthenticated Requests"

# Welcome message
make_request "GET" "$BASE_URL/"

# Get API documentation
make_request "GET" "$BASE_URL/api/docs"

# Get menu (unauthenticated)
make_request "GET" "$BASE_URL/api/order/menu"

# List all franchises (unauthenticated)
make_request "GET" "$BASE_URL/api/franchise"

# Trigger a 404 error (unhandled exception)
make_request "GET" "$BASE_URL/invalid-endpoint"

# Step 2: Register a New User (Diner)
print_section "Register a New User (Diner)"
random_email="test$(date +%s)@test.com"
make_request "POST" "$BASE_URL/api/auth" "-H \"Content-Type: application/json\"" "{\"name\":\"testuser\",\"email\":\"$random_email\",\"password\":\"testpass\"}"

# Extract the diner token (assumes jq is installed)
diner_response=$(curl -s -X POST "$BASE_URL/api/auth" -H "Content-Type: application/json" -d "{\"name\":\"testuser\",\"email\":\"$random_email\",\"password\":\"testpass\"}")
diner_token=$(echo "$diner_response" | jq -r '.token')
echo "Diner Token: $diner_token"

# Step 3: Login as Diner
print_section "Login as Diner"
make_request "PUT" "$BASE_URL/api/auth" "-H \"Content-Type: application/json\"" "{\"email\":\"$random_email\",\"password\":\"testpass\"}"

# Step 4: Authenticated Requests as Diner
print_section "Authenticated Requests as Diner"

# Get user orders
make_request "GET" "$BASE_URL/api/order" "-H \"Authorization: Bearer $diner_token\""

# Get user's franchises (should be empty for diner)
make_request "GET" "$BASE_URL/api/franchise/2" "-H \"Authorization: Bearer $diner_token\""

# Try to create a franchise (should fail, diner role)
make_request "POST" "$BASE_URL/api/franchise" "-H \"Content-Type: application/json\" -H \"Authorization: Bearer $diner_token\"" "{\"name\":\"dinerFranchise\",\"admins\":[{\"email\":\"$random_email\"}]}"

# Create an order (triggers factory request)
# Note: Requires a valid franchiseId, storeId, and menuId. Using IDs from your menu data.
make_request "POST" "$BASE_URL/api/order" "-H \"Content-Type: application/json\" -H \"Authorization: Bearer $diner_token\"" "{\"franchiseId\":1,\"storeId\":1,\"items\":[{\"menuId\":1,\"description\":\"Veggie\",\"price\":0.05}]}"

# Step 5: Login as Admin
print_section "Login as Admin (Default: a@jwt.com)"
admin_response=$(curl -s -X PUT "$BASE_URL/api/auth" -H "Content-Type: application/json" -d "{\"email\":\"a@jwt.com\",\"password\":\"admin\"}")
admin_token=$(echo "$admin_response" | jq -r '.token')
echo "Admin Token: $admin_token"

# Step 6: Authenticated Requests as Admin
print_section "Authenticated Requests as Admin"

# Add a menu item
make_request "PUT" "$BASE_URL/api/order/menu" "-H \"Content-Type: application/json\" -H \"Authorization: Bearer $admin_token\"" "{\"title\":\"NewPizza$(date +%s)\",\"description\":\"Test pizza\",\"image\":\"test.png\",\"price\":0.01}"

# Create a franchise
make_request "POST" "$BASE_URL/api/franchise" "-H \"Content-Type: application/json\" -H \"Authorization: Bearer $admin_token\"" "{\"name\":\"testFranchise$(date +%s)\",\"admins\":[{\"email\":\"a@jwt.com\"}]}"

# Extract the franchise ID (assumes the last created franchise)
franchise_response=$(curl -s -X POST "$BASE_URL/api/franchise" -H "Content-Type: application/json" -H "Authorization: Bearer $admin_token" -d "{\"name\":\"testFranchise$(date +%s)\",\"admins\":[{\"email\":\"a@jwt.com\"}]}")
franchise_id=$(echo "$franchise_response" | jq -r '.id')
echo "Franchise ID: $franchise_id"

# Create a store
make_request "POST" "$BASE_URL/api/franchise/$franchise_id/store" "-H \"Content-Type: application/json\" -H \"Authorization: Bearer $admin_token\"" "{\"name\":\"TestStore$(date +%s)\"}"

# Extract the store ID
store_response=$(curl -s -X POST "$BASE_URL/api/franchise/$franchise_id/store" -H "Content-Type: application/json" -H "Authorization: Bearer $admin_token" -d "{\"name\":\"TestStore$(date +%s)\"}")
store_id=$(echo "$store_response" | jq -r '.id')
echo "Store ID: $store_id"

# Delete the store
make_request "DELETE" "$BASE_URL/api/franchise/$franchise_id/store/$store_id" "-H \"Authorization: Bearer $admin_token\""

# Delete the franchise
make_request "DELETE" "$BASE_URL/api/franchise/$franchise_id" "-H \"Authorization: Bearer $admin_token\""

# Step 7: Logout
print_section "Logout Users"

# Logout diner
make_request "DELETE" "$BASE_URL/api/auth" "-H \"Authorization: Bearer $diner_token\""

# Logout admin
make_request "DELETE" "$BASE_URL/api/auth" "-H \"Authorization: Bearer $admin_token\""

# Step 8: Loop to Generate Continuous Traffic
print_section "Starting Continuous Traffic Loop"
while true; do
  # Unauthenticated: Get menu
  make_request "GET" "$BASE_URL/api/order/menu"
  
  # Register a new user
  random_email="loop$(date +%s)@test.com"
  make_request "POST" "$BASE_URL/api/auth" "-H \"Content-Type: application/json\"" "{\"name\":\"loopuser\",\"email\":\"$random_email\",\"password\":\"looppass\"}"
  
  # Login to get a new token
  loop_response=$(curl -s -X PUT "$BASE_URL/api/auth" -H "Content-Type: application/json" -d "{\"email\":\"$random_email\",\"password\":\"looppass\"}")
  loop_token=$(echo "$loop_response" | jq -r '.token')
  
  # Authenticated: Get orders
  make_request "GET" "$BASE_URL/api/order" "-H \"Authorization: Bearer $loop_token\""
  
  # Sleep for a short interval
  sleep 2
done