import sys
import tkinter as tk
from scribeai import ScribeAIApp

try:
    root = tk.Tk()
    # Hide the window immediately so we don't open a GUI
    root.withdraw()
    app = ScribeAIApp(root, "test")
    print("SUCCESS: Initialized successfully without errors!")
except Exception as e:
    import traceback
    print("ERROR: Failed to initialize:")
    traceback.print_exc()
    sys.exit(1)
sys.exit(0)
