import os
import http.server
import socketserver
import webbrowser
import threading
import time
import json  # For safely embedding the list into JavaScript
import socket

PORT = 8000
HOST = "0.0.0.0"
INDEX_FILENAME = "index.html"
CSS_FILENAME = "style.css"
SERVER_ADDRESS = f"http://{HOST}:{PORT}"
INDEX_URL = f"{SERVER_ADDRESS}/{INDEX_FILENAME}"

def get_lan_ip():
    """Get the local IP address."""
    try:
        # Create a socket to connect to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        return ip
    except Exception as e:
        print(f"Error getting local IP: {e}")
        return None
    finally:
        if s:
            s.close()

def find_html_files(directory="."):
    """Finds all .html files in the specified directory, excluding index.html."""
    files = []
    try:
        for entry in os.listdir(directory):
            if (os.path.isfile(os.path.join(directory, entry)) and
                    entry.lower().endswith(".html") and
                    entry.lower() != INDEX_FILENAME.lower()):
                files.append(entry)
                # print(f"Found HTML file: {entry}")
        files.sort() # Sort alphabetically
        return files
    except FileNotFoundError:
        print(f"Error: Directory not found: {directory}")
        return []
    except Exception as e:
        print(f"An error occurred while searching for HTML files: {e}")
        return []

def generate_index_html(html_files):
    """Generates the content for index.html."""
    # Safely embed the list of filenames into the JavaScript code
    # json.dumps creates a valid JSON array string, which is also valid JavaScript
    files_json = json.dumps(html_files)
    # print(f"Generated HTML files list: {files_json}")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML File Index</title>
    <link rel="stylesheet" href="{CSS_FILENAME}">
</head>
<body>
    <div class="container">
        <h1>Available HTML Files</h1>
        <ul id="file-list">
            {f'<li>No other HTML files found in this directory.</li>' if not html_files else ''}
        </ul>
    </div>

    <script>
        const htmlFiles = {files_json}; // Files are embedded here by Python
        const fileListElement = document.getElementById('file-list');

        if (htmlFiles.length > 0 && fileListElement) {{
            htmlFiles.forEach(filename => {{
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.href = filename; // Link directly to the file
                link.textContent = filename.replace(/\\.html$/i, ''); // Display name without .html
                listItem.appendChild(link);
                fileListElement.appendChild(listItem);
            }});
        }}
    </script>
</body>
</html>"""
    try:
        with open(INDEX_FILENAME, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Generated {INDEX_FILENAME}")
    except IOError as e:
        print(f"Error writing {INDEX_FILENAME}: {e}")


def generate_css():
    """Generates the content for style.css."""
    css_content = """
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    /* Dark background for the whole page */
    background-color: #1e1e1e;
    /* Light text color for readability */
    color: #e0e0e0;
    display: flex;
    justify-content: center;
    padding-top: 40px;
}

.container {
    max-width: 700px;
    width: 90%;
    /* Slightly lighter dark background for the main content area */
    background-color: #2d2d2d;
    padding: 30px 40px;
    border-radius: 8px;
    /* Adjusted shadow for dark mode - can be subtle dark or even a faint light glow */
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    /* Alternative: light glow shadow */
    /* box-shadow: 0 0 15px rgba(255, 255, 255, 0.05); */
}

h1 {
    text-align: center;
    /* Light heading color */
    color: #ffffff;
    margin-bottom: 30px;
    /* Darker border, slightly lighter than container background */
    border-bottom: 1px solid #444;
    padding-bottom: 15px;
}

#file-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

#file-list li {
    margin-bottom: 12px;
    /* Darker border for list items */
    border: 1px solid #444;
    border-radius: 5px;
    transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}

#file-list li:hover {
     /* Slightly more prominent shadow on hover */
     box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
     /* Optional: slightly lighten border on hover */
     border-color: #555;
}

#file-list a {
    display: block;
    padding: 12px 18px;
    text-decoration: none;
    /* Brighter link color for contrast on dark background */
    color: #5dade2; /* Lighter blue */
    font-weight: 500;
    transition: background-color 0.2s ease, color 0.2s ease;
    border-radius: 5px; /* Match parent li for better hover */
}

#file-list a:hover {
    /* Darker, subtle background on hover */
    background-color: #3a3a3a;
    /* Slightly lighter/different link color on hover */
    color: #85c1e9;
}

/* Style for the 'no files found' message */
#file-list li:only-child {
    border: none; /* Keep borderless */
    text-align: center;
    /* Lighter gray for placeholder text */
    color: #888;
    font-style: italic;
    padding: 20px 0;
}

/* Optional: Style scrollbars for a more complete dark mode look (Webkit browsers) */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: #2d2d2d; /* Track color matching container */
}

::-webkit-scrollbar-thumb {
    background-color: #555; /* Scrollbar handle color */
    border-radius: 4px;
    border: 2px solid #2d2d2d; /* Creates padding around thumb */
}

::-webkit-scrollbar-thumb:hover {
    background-color: #777; /* Handle color on hover */
}
"""
    try:
        with open(CSS_FILENAME, "w", encoding="utf-8") as f:
            f.write(css_content)
        print(f"Generated {CSS_FILENAME}")
    except IOError as e:
        print(f"Error writing {CSS_FILENAME}: {e}")


def start_server():
    """Starts the HTTP server in a separate thread."""
    Handler = http.server.SimpleHTTPRequestHandler
    # Allow address reuse so you can restart the script quickly
    socketserver.TCPServer.allow_reuse_address = True

    local_url = f"http://localhost:{PORT}/{INDEX_FILENAME}"
    lan_ip = get_lan_ip()
    network_url = None
    if lan_ip:
        network_url = f"http://{lan_ip}:{PORT}/{INDEX_FILENAME}"

    try:
        httpd = socketserver.TCPServer((HOST, PORT), Handler)
    except OSError as e:
        print(f"Error starting server on {HOST}:{PORT} - {e}")
        print("The port might be in use. or you might need permission.")
        print("If using 0.0.0.0, check your firewall settings.")
        return

    print(f"Serving HTTP on {HOST} (all interfaces)port {PORT}...")
    print(f"Serving files from: {os.getcwd()}")
    print("-" * 30 )
    print("Access locally: {local_url}")
    if network_url:
        print(f"Access from network: {network_url}")
    else:
        print("No local network access available.")
    print("-" * 30)
    print("Press Ctrl+C to stop the server.")

    # Run the server in a separate thread
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    # Give the server a moment to start up
    time.sleep(1)

    # Open the browser
    try:
        webbrowser.open(local_url)
        print(f"Opened {local_url} in your default browser.")
    except Exception as e:
        print(f"Could not open browser automatically: {e}")
        print(f"Please open this URL manually: {local_url}")

    # Keep the main thread alive until Ctrl+C (or server thread exits)
    try:
        while server_thread.is_alive():
            time.sleep(0.5) # Keep main thread alive polling server thread
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.shutdown() # Properly shut down the server
        httpd.server_close()
        print("Server stopped.")


if __name__ == "__main__":
    # 1. Find HTML files
    html_files = find_html_files()

    # 2. Generate index.html
    generate_index_html(html_files)

    # 3. Generate style.css
    generate_css()

    # 4. Start server and open browser
    start_server()