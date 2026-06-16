import sys
import ctypes

class CGPoint(ctypes.Structure):
    _fields_ = [("x", ctypes.c_double), ("y", ctypes.c_double)]

# Load CoreGraphics
cg = ctypes.CDLL("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
cg.CGEventCreateMouseEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint32, CGPoint, ctypes.c_uint32]
cg.CGEventCreateMouseEvent.restype = ctypes.c_void_p
cg.CGEventPost.argtypes = [ctypes.c_uint32, ctypes.c_void_p]

# Declare Warp cursor function (bypasses Accessibility permission requirement)
cg.CGWarpMouseCursorPosition.argtypes = [CGPoint]
cg.CGWarpMouseCursorPosition.restype = ctypes.c_int32

def move(x, y):
    pos = CGPoint(x, y)
    cg.CGWarpMouseCursorPosition(pos)

def click(x, y):
    pos = CGPoint(x, y)
    # Down
    event_down = cg.CGEventCreateMouseEvent(None, 1, pos, 0) # 1 = LeftMouseDown
    cg.CGEventPost(0, event_down)
    cg.CFRelease(event_down)
    # Up
    event_up = cg.CGEventCreateMouseEvent(None, 2, pos, 0) # 2 = LeftMouseUp
    cg.CGEventPost(0, event_up)
    cg.CFRelease(event_up)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)
    action = sys.argv[1]
    try:
        x = float(sys.argv[2])
        y = float(sys.argv[3])
    except ValueError:
        sys.exit(1)
        
    if action == "move":
        move(x, y)
    elif action == "click":
        click(x, y)
