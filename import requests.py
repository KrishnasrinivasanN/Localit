import requests
import re

def secret_message(url):
    text = requests.get(url).text
    
    pattern = re.findall(r'(\d+)\s+(.)\s+(\d+)', text)

    if not pattern:
        return

    points = [(int(x), int(y), ch) for x, ch, y in pattern]

    max_x = max(x for x, _, _ in points)
    max_y = max(y for _, y, _ in points)

    grid = [[" " for _ in range(max_x + 1)] for _ in range(max_y + 1)]

    for x, y, ch in points:
        grid[y][x] = ch

    for row in grid:
        print("".join(row))
        
secret_message("https://docs.google.com/document/d/e/2PACX-1vSvM5gDlNvt7npYHhp_XfsJvuntUhq184By5xO_pA4b_gCWeXb6dM6ZxwN8rE6S4ghUsCj2VKR21oEP/pub")