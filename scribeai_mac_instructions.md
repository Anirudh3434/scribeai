# Setup Guide: ScribeAI Global macOS Writing Assistant

You can use ScribeAI in **every native macOS application** (Notion, Slack, Notes, Word, Finder, Safari, Messages, etc.) by setting up a macOS Shortcut. Follow these quick steps:

---

### Step 1: Open the Shortcuts App
1. Open the **Shortcuts** app on your Mac (you can find it in your Applications folder or search via Spotlight `Cmd + Space`).
2. Click the **+** (plus) icon in the top toolbar to create a new shortcut.

---

### Step 2: Name & Configure the Shortcut
1. In the top-left corner of the editor, click the title "Untitled Shortcut" and rename it to **ScribeAI**.
2. In the right-hand panel, click on the **Shortcut Details** tab (the icon looks like three sliders or an 'i').
3. Check the checkbox for **Use as Quick Action**.
4. **Important**: Under the Quick Action settings, make sure **Provide Output** is **CHECKED**. This lets Shortcuts replace the selected text with ScribeAI's refined output without using blocked simulated keystrokes.
5. In the checklist under it, make sure **Services Menu** is checked.
6. (Optional but recommended) Click **Add Keyboard Shortcut** and press your desired global key combination, such as **Command + Shift + G** (`⌘⇧G`).

---

### Step 3: Add Workflow Actions
In the main workflow builder area, configure the following block sequence:

1. **Input Configuration** (at the very top of the window):
   - Set it to: **Receive [text] from [Quick Actions]**
   - Click "if there's no input" and choose: **Provide Output** or **Do Nothing**.

2. **Run Shell Script Action**:
   - In the right-hand search bar, search for **Run Shell Script** and double-click or drag it into the main canvas.
   - Set **Shell** to: `/bin/zsh`
   - Set **Pass Input** to: **as arguments**
   - In the text box, replace the entire script with this command:
     ```bash
     LOCKFILE="$HOME/.scribeai.lock"
     if [ -f "$LOCKFILE" ]; then
       LAST_RUN=$(cat "$LOCKFILE")
       CURRENT_TIME=$(date +%s)
       if [ $((CURRENT_TIME - LAST_RUN)) -lt 2 ]; then
         exit 0
       fi
     fi
     date +%s > "$LOCKFILE"

     /Users/anirudhbhardwaj/Desktop/extension/desktop/node_modules/.bin/electron /Users/anirudhbhardwaj/Desktop/extension/desktop "$1"
     if [ $? -eq 0 ]; then
       date +%s > "$LOCKFILE"
     fi
     ```

3. Remove any old paste automation from the script. These lines must not be present:
   ```bash
   osascript -e 'tell application "System Events" to keystroke "v" using command down'
   ```

4. Remove any separate **Stop and Output** action if insertion does not happen automatically. With **Provide Output** enabled, the Run Shell Script result is enough for Shortcuts to replace the selected text.

*(Note: Do not add any `System Events` or `keystroke` actions. ScribeAI prints the refined text back to the Shortcut, and Shortcuts uses **Provide Output** to replace the selected text natively.)*

5. Close the Shortcuts app. Your shortcut is saved!

---

### How to Use ScribeAI Globally:
1. Go to any app (e.g. native **Notes**, **Slack**, or **Word**).
2. Select any sentence or block of text.
3. Press **Command + Shift + G** (or right-click the selected text, choose **Services** -> **ScribeAI**).
4. The ScribeAI desktop panel will appear centered on your screen, preloaded with your selection.
5. Select a tone, add custom prompts if desired, and click **Improve Writing**.
6. The panel will animate with the done tick checkmark.
7. Click **Insert Text**. ScribeAI will send the refined text back to Shortcuts, and Shortcuts will replace the selected text.
