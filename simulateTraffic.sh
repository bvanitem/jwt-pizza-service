#!/bin/bash

# Check if host is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  exit 1
fi
host=$1

# Trap SIGINT (Ctrl+C) to execute the cleanup function
cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8 $pid9 $pid10 2>/dev/null
  exit 0
}
trap cleanup SIGINT

# Wrap curl command to return HTTP response codes
execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

# Function to login and get a token
login() {
  response=$(curl -s -X PUT $host/api/auth -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo $token
}

# Simulate a user requesting the menu every 3 seconds
while true; do
  result=$(execute_curl $host/api/order/menu)
  echo "Requesting menu..." $result
  sleep 3
done &
pid1=$!

# Simulate a user with an invalid email and password every 15 seconds (increased frequency)
while true; do
  result=$(execute_curl "-X PUT \"$host/api/auth\" -d '{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}' -H 'Content-Type: application/json'")
  echo "Logging in with invalid credentials..." $result
  sleep 15
done &
pid2=$!

# Simulate a franchisee logging in every 90 seconds (increased frequency)
while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "Login franchisee..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 80
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out franchisee..." $result
  sleep 10
done &
pid3=$!

# Simulate a diner ordering a pizza every 40 seconds (increased frequency)
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought a pizza..." $result
  sleep 20
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner..." $result
  sleep 20
done &
pid4=$!

# Simulate a failed pizza order every 3 minutes (increased frequency)
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login hungry diner..." $( [ -z "$token" ] && echo "false" || echo "true" )

  items='{ "menuId": 1, "description": "Veggie", "price": 0.05 }'
  for (( i=0; i < 21; i++ ))
  do items+=', { "menuId": 1, "description": "Veggie", "price": 0.05 }'
  done
  
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}'  -H \"Authorization: Bearer $token\"")
  echo "Bought too many pizzas..." $result  
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out hungry diner..." $result
  sleep 175
done &
pid5=$!

# NEW: Simulate an admin adding a menu item every 2 minutes
while true; do
  token=$(login "a@jwt.com" "admin")
  echo "Login admin..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X PUT $host/api/order/menu -H 'Content-Type: application/json' -d '{ \"title\":\"Pepperoni\", \"description\": \"Classic pepperoni pizza\", \"image\":\"pizza2.png\", \"price\": 0.004 }' -H \"Authorization: Bearer $token\"")
  echo "Admin added menu item..." $result
  sleep 110
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out admin..." $result
  sleep 10
done &
pid6=$!

# NEW: Simulate user registration every 1 minute
while true; do
  random_id=$((RANDOM % 1000))
  result=$(execute_curl "-X POST $host/api/auth -H 'Content-Type: application/json' -d '{\"name\":\"User $random_id\", \"email\":\"user$random_id@jwt.com\", \"password\":\"password$random_id\"}'")
  echo "Registering new user (user$random_id@jwt.com)..." $result
  sleep 60
done &
pid7=$!

# NEW: Simulate a failed order due to invalid franchiseId every 2 minutes
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner for invalid order..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 999, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }]}' -H \"Authorization: Bearer $token\"")
  echo "Failed order (invalid franchiseId)..." $result
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner..." $result
  sleep 115
done &
pid8=$!

# NEW: Simulate franchise creation and deletion every 4 minutes (admin action)
while true; do
  token=$(login "a@jwt.com" "admin")
  echo "Login admin for franchise management..." $( [ -z "$token" ] && echo "false" || echo "true" )
  
  # Create a franchise
  result=$(execute_curl "-X POST $host/api/franchise -H 'Content-Type: application/json' -d '{\"name\": \"PizzaChain $RANDOM\", \"admins\": [{\"email\": \"f@jwt.com\"}]}' -H \"Authorization: Bearer $token\"")
  echo "Created franchise..." $result
  
  # Assume the franchise ID is 1 (you may need to parse the response to get the actual ID)
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/franchise/1 -H \"Authorization: Bearer $token\"")
  echo "Deleted franchise..." $result
  
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out admin..." $result
  sleep 230
done &
pid9=$!

# NEW: Simulate an unauthorized request to a protected endpoint every 30 seconds
while true; do
  result=$(execute_curl "-X GET $host/api/order")
  echo "Unauthorized request to get orders..." $result
  sleep 30
done &
pid10=$!

# Wait for the background processes to complete
wait $pid1 $pid2 $pid3 $pid4 $pid5 $pid6 $pid7 $pid8 $pid9 $pid10