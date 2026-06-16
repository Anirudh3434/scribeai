const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

function setupShortcut() {
  // ScribeAI shortcut automation is only applicable on macOS (darwin)
  if (process.platform !== 'darwin') return;

  try {
    const homeDir = os.homedir();
    const servicesDir = path.join(homeDir, 'Library/Services');
    const workflowName = 'ScribeAI.workflow';
    const workflowDir = path.join(servicesDir, workflowName);
    const contentsDir = path.join(workflowDir, 'Contents');

    // Create ScribeAI.workflow structure
    fs.mkdirSync(contentsDir, { recursive: true });

    // Determine target execution path (supports both packaged app and local development)
    const isDev = !app.isPackaged;
    let execCommandEscaped;
    if (isDev) {
      execCommandEscaped = `&quot;${process.execPath}&quot; &quot;${app.getAppPath()}&quot;`;
    } else {
      // Run the packaged binary directly to allow synchronous execution and stdout capture
      execCommandEscaped = `&quot;${process.execPath}&quot;`;
    }

    // Build document.wflow XML containing the zsh run wrapper
    const documentWflow = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>523</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMApplication</key>
				<array>
					<string>Automator</string>
				</array>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key>
					<dict/>
					<key>CheckedForUserDefaultShell</key>
					<dict/>
					<key>inputMethod</key>
					<dict/>
					<key>shell</key>
					<dict/>
					<key>source</key>
					<dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>DBG_LOG=&quot;/tmp/scribeai_service.log&quot;
echo &quot;=== Service Triggered ===&quot; &gt;&gt; &quot;$DBG_LOG&quot;
echo &quot;Time: $(date)&quot; &gt;&gt; &quot;$DBG_LOG&quot;
echo &quot;Input text length: \${#1}&quot; &gt;&gt; &quot;$DBG_LOG&quot;

LOCKFILE=&quot;$HOME/.scribeai.lock&quot;
if [ -f &quot;$LOCKFILE&quot; ]; then
  LAST_RUN=$(cat &quot;$LOCKFILE&quot;)
  CURRENT_TIME=$(date +%s)
  if [ $((CURRENT_TIME - LAST_RUN)) -lt 2 ]; then
    echo &quot;Rate-limiting trigger (less than 2s). Exiting.&quot; &gt;&gt; &quot;$DBG_LOG&quot;
    exit 0
  fi
fi
date +%s &gt; &quot;$LOCKFILE&quot;

echo &quot;Launching App: ${execCommandEscaped} $1&quot; &gt;&gt; &quot;$DBG_LOG&quot;
${execCommandEscaped} &quot;$1&quot; 2&gt;&gt; &quot;$DBG_LOG&quot;
ERR_CODE=$?
echo &quot;Open command exit code: $ERR_CODE&quot; &gt;&gt; &quot;$DBG_LOG&quot;
if [ $ERR_CODE -eq 0 ]; then
  date +%s &gt; &quot;$LOCKFILE&quot;
fi</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/zsh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>A590CD33-7DCE-42E1-A87A-D522EE2B40D9</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
					<string>Command</string>
					<string>Run</string>
				</array>
				<key>OutputUUID</key>
				<string>F7A02C1F-02D1-4B9D-9F7C-9BD668C66567</string>
				<key>UUID</key>
				<string>79DE4497-27C8-4DE3-BCF4-13B2EAD74187</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
				<key>arguments</key>
				<dict>
					<key>0</key>
					<dict>
						<key>default value</key>
						<integer>0</integer>
						<key>name</key>
						<string>inputMethod</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>0</string>
					</dict>
					<key>1</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>source</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>1</string>
					</dict>
					<key>2</key>
					<dict>
						<key>default value</key>
						<false/>
						<key>name</key>
						<string>CheckedForUserDefaultShell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>2</string>
					</dict>
					<key>3</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>COMMAND_STRING</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>3</string>
					</dict>
					<key>4</key>
					<dict>
						<key>default value</key>
						<string>/bin/sh</string>
						<key>name</key>
						<string>shell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>4</string>
					</dict>
				</dict>
				<key>isViewVisible</key>
				<true/>
			</dict>
			<key>isViewVisible</key>
			<true/>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceProcessesInput</key>
		<integer>1</integer>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>`;

    // Build Info.plist XML registering this as a text processing Service
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>ScribeAI</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSSendTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
			<key>NSReturnTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
		</dict>
	</array>
</dict>
</plist>`;

    // Write the Service package files to ~/Library/Services/ScribeAI.workflow/Contents
    fs.writeFileSync(path.join(contentsDir, 'document.wflow'), documentWflow);
    fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist);

    // Register keyboard shortcut equivalent (Command + Option + S) for the service in plist
    const registerCmd = 'defaults write pbs NSServicesStatus -dict-add \'"(null) - ScribeAI - runWorkflowAsService"\' \'{key_equivalent = "@~s";}\'';
    exec(registerCmd, (err) => {
      if (err) {
        console.error('Failed to configure macOS keyboard shortcut defaults:', err);
        return;
      }
      
      // Force macOS Services database reload
      exec('/System/Library/CoreServices/pbs -update', (updateErr) => {
        if (updateErr) {
          console.error('Failed to reload macOS Pasteboard Server cache:', updateErr);
        } else {
          console.error('Successfully registered ScribeAI Quick Action with hotkey Command+Option+S.');
        }
      });
    });

  } catch (error) {
    console.error('Error during ScribeAI shortcut registration:', error);
  }
}

module.exports = { setupShortcut };
