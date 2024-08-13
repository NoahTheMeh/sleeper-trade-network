# %%
import requests
import json

# Sleeper API endpoint to fetch all NFL players
url = "https://api.sleeper.app/v1/players/nfl"

# Fetch all NFL players
response = requests.get(url)
players = response.json()

# Dictionary to store player_id and player name
player_data = {}

# Process each player in the response
for player_id, player_info in players.items():
    # Extract first and last name
    first_name = player_info.get("first_name", "")
    last_name = player_info.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip()

    # Store in the dictionary with player_id as the key
    if full_name:  # Only add if the name is not empty
        player_data[player_id] = full_name

# Write the player data to a JSON file
with open("player_names.json", "w") as json_file:
    json.dump(player_data, json_file, indent=4)

print("Player data has been written to player_names.json")

# %%
