#!/usr/bin/env python3
import sys
import json
import urllib.request
import urllib.error
import threading
import tkinter as tk
from tkinter import font as tkfont

# Built-in AI calls are proxied through the Supabase Edge Function.
# The actual Gemini key is stored as a secret in the Supabase dashboard.
PROXY_URL = "https://pqcqtpvmgziejnauidsu.supabase.co/functions/v1/proxy-gemini"
MODEL = "gemini-flash-latest"

# Custom Label-based Button to support complete color customization on macOS
class ScribeButton(tk.Label):
    def __init__(self, parent, text, command, bg="#7c3aed", fg="white", hover_bg="#8b5cf6", font=None, width=None):
        tk.Label.__init__(
            self,
            parent, 
            text=text, 
            bg=bg, 
            fg=fg, 
            font=font, 
            cursor="hand2", 
            relief="flat", 
            padx=16, 
            pady=8,
            bd=0,
            anchor="center"
        )
        if width:
            self.configure(width=width)
        self.command = command
        self.bg = bg
        self.hover_bg = hover_bg
        
        self.bind("<ButtonRelease-1>", self.on_click)
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, event):
        self.configure(bg=self.hover_bg)

    def on_leave(self, event):
        self.configure(bg=self.bg)

    def on_click(self, event):
        self.command()

# Custom Label-based Chip to support color customization on macOS
class ScribeChip(tk.Label):
    def __init__(self, parent, text, value, app, font=None):
        self.app = app
        self.value = value
        tk.Label.__init__(
            self,
            parent,
            text=text,
            font=font,
            cursor="hand2",
            relief="flat",
            padx=12,
            pady=5,
            bd=0,
            anchor="center"
        )
        self.update_state()
        self.bind("<ButtonRelease-1>", self.on_click)
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def update_state(self):
        is_active = self.app.active_tone == self.value
        if is_active:
            self.configure(bg="#2d224d", fg="#c084fc")
        else:
            self.configure(bg="#16122c", fg="#9ca3af")

    def on_enter(self, event):
        is_active = self.app.active_tone == self.value
        if not is_active:
            self.configure(bg="#1f1a3a", fg="#f3f4f6")

    def on_leave(self, event):
        self.update_state()

    def on_click(self, event):
        self.app.select_tone(self.value)

class ScribeAIApp:
    def __init__(self, root, initial_text):
        self.root = root
        self.initial_text = initial_text
        self.refined_text = ""
        self.active_tone = "improve"
        
        self.root.title("ScribeAI Assistant")
        self.root.configure(bg="#0f0c1b")
        self.root.resizable(False, False)
        
        # Make the window float on top of other desktop apps
        self.root.attributes("-topmost", True)
        
        # Set colors
        self.bg_color = "#0f0c1b"
        self.card_bg = "#16122c"
        self.text_color = "#f3f4f6"
        self.purple = "#7c3aed"
        self.purple_hover = "#8b5cf6"
        self.green = "#10b981"
        self.green_hover = "#059669"
        self.gray = "#9ca3af"
        self.error_red = "#f87171"

        # Fonts
        self.title_font = tkfont.Font(family="Helvetica", size=13, weight="bold")
        self.body_font = tkfont.Font(family="Helvetica", size=11)
        self.button_font = tkfont.Font(family="Helvetica", size=11, weight="bold")
        self.chip_font = tkfont.Font(family="Helvetica", size=10, weight="bold")

        # Container frame (set explicit bg to force dark mode rendering)
        self.container = tk.Frame(self.root, bg=self.bg_color, bd=0, highlightthickness=0)
        self.container.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Delay initialization of UI to let the event loop start first.
        # This completely avoids TclErrors like "application has been destroyed" 
        # on older macOS/Xcode Python 3.9 Tcl/Tk installations.
        self.root.after(10, self.start_ui)

    def start_ui(self):
        self.state_input()

        # Force window refresh, layering level, and keyboard focus under macOS Window Manager
        self.root.lift()
        self.root.focus_force()

    def center_window(self, width, height):
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (width // 2)
        y = (screen_height // 2) - (height // 2)
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    def clear_container(self):
        for widget in self.container.winfo_children():
            widget.destroy()

    def state_input(self):
        self.clear_container()
        self.center_window(440, 260)
        
        # Title/Header
        header_frame = tk.Frame(self.container, bg=self.bg_color)
        header_frame.pack(fill="x", pady=(0, 10))
        
        lbl_title = tk.Label(
            header_frame, 
            text="ScribeAI Assistant", 
            fg="#c084fc", 
            bg=self.bg_color, 
            font=self.title_font
        )
        lbl_title.pack(side="left")
        
        lbl_powered = tk.Label(
            header_frame, 
            text="powered by Gemini", 
            fg="#a78bfa", 
            bg=self.bg_color, 
            font=("Helvetica", 9)
        )
        lbl_powered.pack(side="left", padx=(6, 0), pady=(3, 0))

        # Tone Selector Label
        lbl_tone = tk.Label(
            self.container, 
            text="Select Tone:", 
            fg=self.gray, 
            bg=self.bg_color, 
            font=self.body_font
        )
        lbl_tone.pack(anchor="w", pady=(0, 8))

        # Chips/Tone Buttons
        self.chips_frame = tk.Frame(self.container, bg=self.bg_color)
        self.chips_frame.pack(fill="x", pady=(0, 14))
        
        self.tones = [
            ("Refine", "improve"),
            ("Business", "professional"),
            ("Casual", "casual"),
            ("Short", "concise"),
            ("Expand", "expand")
        ]
        self.chip_widgets = {}
        self.draw_chips()

        # Custom prompt text area (explicit styles to prevent macOS theme override)
        self.custom_prompt = tk.Text(
            self.container, 
            height=3, 
            bg="#16122c", 
            fg=self.text_color, 
            insertbackground="white",
            relief="flat", 
            bd=0,
            highlightthickness=1, 
            highlightbackground="#2d284a",
            highlightcolor=self.purple,
            font=self.body_font,
            padx=10,
            pady=10
        )
        self.custom_prompt.pack(fill="x", pady=(0, 16))
        self.custom_prompt.insert("1.0", "")
        self.custom_prompt.placeholder = "e.g. Translate to French, use bullet points..."
        self.custom_prompt.bind("<FocusIn>", self.on_focus_in)
        self.custom_prompt.bind("<FocusOut>", self.on_focus_out)
        self.add_placeholder()
        self.custom_prompt.focus_set()

        # Submit Action Button (Label-based ScribeButton)
        btn_submit = ScribeButton(
            self.container,
            text="Improve Writing",
            command=self.trigger_refinement,
            bg=self.purple,
            fg="white",
            hover_bg=self.purple_hover,
            font=self.button_font
        )
        btn_submit.pack(fill="x")

    def add_placeholder(self):
        self.custom_prompt.insert("1.0", self.custom_prompt.placeholder)
        self.custom_prompt.configure(fg="#6b7280")

    def on_focus_in(self, event):
        if self.custom_prompt.get("1.0", "end-1c") == self.custom_prompt.placeholder:
            self.custom_prompt.delete("1.0", "end")
            self.custom_prompt.configure(fg=self.text_color)

    def on_focus_out(self, event):
        if not self.custom_prompt.get("1.0", "end-1c").strip():
            self.add_placeholder()

    def draw_chips(self):
        for tone_name, tone_val in self.tones:
            chip = ScribeChip(
                self.chips_frame,
                text=tone_name,
                value=tone_val,
                app=self,
                font=self.chip_font
            )
            chip.pack(side="left", padx=(0, 6))
            self.chip_widgets[tone_val] = chip

    def select_tone(self, tone):
        self.active_tone = tone
        for tone_val, widget in self.chip_widgets.items():
            widget.update_state()

    def trigger_refinement(self):
        # Read custom instruction
        custom_inst = self.custom_prompt.get("1.0", "end-1c").strip()
        if custom_inst == self.custom_prompt.placeholder:
            custom_inst = ""
            
        # Switch to compact loading state
        self.state_loading()
        
        # Fire background thread
        thread = threading.Thread(target=self.run_api_call, args=(custom_inst,))
        thread.start()

    def state_loading(self):
        self.clear_container()
        self.center_window(300, 180)
        
        # Pulse Loading Animation in Canvas
        self.canvas = tk.Canvas(self.container, width=60, height=60, bg=self.bg_color, highlightthickness=0)
        self.canvas.pack(pady=(20, 10))
        
        self.angle = 0
        self.loading_active = True
        self.draw_spinner()
        
        self.lbl_loading = tk.Label(
            self.container, 
            text="ScribeAI is writing...", 
            fg=self.gray, 
            bg=self.bg_color, 
            font=self.body_font
        )
        self.lbl_loading.pack()

    def draw_spinner(self):
        if not self.loading_active:
            return
        self.canvas.delete("all")
        # Draw outer ring
        self.canvas.create_oval(10, 10, 50, 50, outline="#2d284a", width=3)
        # Draw rotating arc
        extent = 90
        self.canvas.create_arc(10, 10, 50, 50, outline=self.purple, width=3, start=self.angle, extent=extent, style="arc")
        self.angle = (self.angle - 10) % 360
        self.root.after(40, self.draw_spinner)

    def state_success(self):
        self.loading_active = False
        self.clear_container()
        self.center_window(300, 180)
        
        # Done Tick Animation in Canvas
        self.success_canvas = tk.Canvas(self.container, width=60, height=60, bg=self.bg_color, highlightthickness=0)
        self.success_canvas.pack(pady=(20, 10))
        
        # Draw Success Text
        lbl_success = tk.Label(
            self.container,
            text="Refinement Complete!",
            fg=self.green,
            bg=self.bg_color,
            font=self.title_font
        )
        lbl_success.pack()
        
        # Start drawing the checkmark
        self.tick_step = 0
        self.animate_checkmark()

    def animate_checkmark(self):
        self.success_canvas.delete("all")
        # Circle
        self.success_canvas.create_oval(8, 8, 52, 52, outline=self.green, width=4)
        
        # Animated Checkmark Lines
        # Point A: (18, 28)
        # Point B: (26, 36)
        # Point C: (38, 20)
        if self.tick_step <= 10:
            # First segment (A to B)
            t = self.tick_step / 10.0
            x = 18 + (26 - 18) * t
            y = 28 + (36 - 28) * t
            self.success_canvas.create_line(18, 28, x, y, fill=self.green, width=4, capstyle="round")
        else:
            # First segment complete, draw second segment (B to C)
            self.success_canvas.create_line(18, 28, 26, 36, fill=self.green, width=4, capstyle="round")
            t = (self.tick_step - 10) / 10.0
            x = 26 + (38 - 26) * t
            y = 36 + (20 - 36) * t
            self.success_canvas.create_line(26, 36, x, y, fill=self.green, width=4, capstyle="round")
            
        if self.tick_step < 20:
            self.tick_step += 1
            self.root.after(20, self.animate_checkmark)
        else:
            # Transition to Results View after 1.2s delay
            self.root.after(1200, self.state_result)

    def state_result(self):
        self.clear_container()
        self.center_window(440, 360)
        
        # Header
        lbl_preview = tk.Label(
            self.container, 
            text="Suggested Version (Editable):", 
            fg=self.gray, 
            bg=self.bg_color, 
            font=self.body_font
        )
        lbl_preview.pack(anchor="w", pady=(0, 8))
        
        # Editable preview box
        self.preview_box = tk.Text(
            self.container,
            height=9,
            bg="#16122c",
            fg=self.text_color,
            insertbackground="white",
            relief="flat",
            bd=0,
            highlightthickness=1,
            highlightbackground="#2d284a",
            highlightcolor=self.purple,
            font=self.body_font,
            padx=10,
            pady=10
        )
        self.preview_box.pack(fill="x", pady=(0, 16))
        self.preview_box.insert("1.0", self.refined_text)
        
        # Buttons Frame
        btn_frame = tk.Frame(self.container, bg=self.bg_color)
        btn_frame.pack(fill="x")
        
        # ScribeButton Label replacements
        btn_insert = ScribeButton(
            btn_frame,
            text="Insert Text",
            command=self.action_insert,
            bg=self.green,
            fg="white",
            hover_bg=self.green_hover,
            font=self.button_font
        )
        btn_insert.pack(side="left", fill="x", expand=True, padx=(0, 6))
        
        btn_cancel = ScribeButton(
            btn_frame,
            text="Cancel",
            command=self.root.quit,
            bg="#2d284a",
            fg=self.gray,
            hover_bg="#3d3762",
            font=self.button_font
        )
        btn_cancel.pack(side="right", fill="x", expand=True, padx=(6, 0))

    def state_error(self, message):
        self.loading_active = False
        self.clear_container()
        self.center_window(360, 200)
        
        lbl_err_title = tk.Label(
            self.container,
            text="Refinement Error",
            fg=self.error_red,
            bg=self.bg_color,
            font=self.title_font
        )
        lbl_err_title.pack(pady=(10, 6))
        
        lbl_err_msg = tk.Label(
            self.container,
            text=message,
            fg=self.text_color,
            bg=self.bg_color,
            font=self.body_font,
            wraplength=320,
            justify="center"
        )
        lbl_err_msg.pack(pady=(0, 16))
        
        btn_retry = ScribeButton(
            self.container,
            text="Retry",
            command=self.state_input,
            bg="#2d284a",
            fg=self.text_color,
            hover_bg="#3d3762",
            font=self.button_font
        )
        btn_retry.pack(fill="x")

    def run_api_call(self, custom_inst):
        # Configure instructions
        tone_prompts = {
            "professional": "Rewrite the text to be highly professional, polite, articulate, and well-structured, suitable for formal business correspondence or emails. Maintain a respectful, clear, and authoritative tone.",
            "casual": "Rewrite the text to be friendly, casual, and conversational, while maintaining clarity and correct grammar. Perfect for quick team chats, Slack messages, or informal emails.",
            "improve": "Refine the grammar, vocabulary, spelling, punctuation, and sentence flow of the text, making it sound natural, polished, and elegant while strictly preserving the original meaning and layout formatting (like line breaks or lists). Avoid sounding overly formal or robotic.",
            "concise": "Shorten the text to make it extremely direct and concise. Remove fluff, redundancy, and passive language while retaining all core details, meaning, and essential context.",
            "expand": "Elaborate on the ideas in the text. Add descriptive details, transitions, and polished vocabulary to make it more comprehensive, engaging, and fully-formed, without repeating points."
        }
        
        tone_instruction = tone_prompts.get(self.active_tone, tone_prompts["improve"])
        custom_prompt = f"Additional custom instruction: {custom_inst}" if custom_inst else ""
        
        system_prompt = (
            "You are ScribeAI, a premium AI writing assistant. Your task is to rewrite, refine, or generate text strictly according to the user's instructions.\n\n"
            "CRITICAL INSTRUCTION FOR OUTPUT FORMATTING:\n"
            "1. Return ONLY the final rewritten/generated text.\n"
            "2. Absolutely NO conversational filler, introductions, or explanations (e.g., do NOT write \"Here is the refined text:\", \"Sure, here is...\", \"Okay\", or \"Hope this helps\").\n"
            "3. Do NOT wrap the output in quotation marks, backticks, or markdown code blocks (do NOT use ``` or similar).\n"
            "4. Preserve the user's paragraph breaks, formatting, list styles, and punctuation wherever possible.\n"
            "5. If the input text is extremely short, generic, or lacks context (e.g., \"test\", single words), do NOT complain or ask for details. Return the polished version or the text as-is.\n"
            "6. If the input is gibberish/placeholders (like \"asdf\" or \"qwerty\") and there is an additional custom instruction, IGNORE the gibberish and generate fresh content based on the custom instruction.\n\n"
            "DIRECTIVE:\n"
            f"{tone_instruction}\n\n"
            f"{custom_prompt}"
        )

        # Call the Supabase Edge Function proxy (Gemini key stored server-side)
        headers = {"Content-Type": "application/json"}
        payload = {
            "systemPrompt": system_prompt,
            "initialText": self.initial_text,
            "model": MODEL
        }
        
        try:
            req = urllib.request.Request(
                PROXY_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req) as res:
                response_data = json.loads(res.read().decode("utf-8"))
                
                refined = response_data.get("text")
                if not refined:
                    raise ValueError("Received an empty or malformed response from the service.")
                
                # Clean Output formatting
                self.refined_text = self.clean_output(refined)
                
                # Transition to Success Done Tick UI
                self.root.after(0, self.state_success)
                
        except urllib.error.HTTPError as e:
            try:
                error_body = json.loads(e.read().decode("utf-8"))
                err_msg = error_body.get("error", {}).get("message") or f"HTTP Error {e.code}"
            except Exception:
                err_msg = f"HTTP Error {e.code}"
            self.root.after(0, lambda msg=err_msg: self.state_error(msg))
        except Exception as e:
            self.root.after(0, lambda msg=str(e): self.state_error(msg))

    def clean_output(self, text):
        cleaned = text.strip()
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1].strip()
        elif cleaned.startswith("'") and cleaned.endswith("'"):
            cleaned = cleaned[1:-1].strip()
            
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines.pop(0)
            if lines and lines[-1] == "```":
                lines.pop()
            cleaned = "\n".join(lines).strip()
        return cleaned

    def action_insert(self):
        final_text = self.preview_box.get("1.0", "end-1c")
        # Print result to stdout so the Shortcuts app can consume it
        sys.stdout.write(final_text)
        sys.stdout.flush()
        self.root.quit()

if __name__ == "__main__":
    # Load input text from stdin or command arguments
    input_text = ""
    if len(sys.argv) > 1:
        input_text = sys.argv[1]
    elif not sys.stdin.isatty():
        input_text = sys.stdin.read()
        
    main_root = tk.Tk()
    app = ScribeAIApp(main_root, input_text)
    main_root.mainloop()
