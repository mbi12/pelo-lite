// Generates a pre-configured MacroDroid / Tasker Bridge Blueprint for Huawei P40 (EMUI / HMS)

function buildHuaweiP40BridgeProfile({ baseUrl, bridgeToken }) {
  const cleanUrl = String(baseUrl || 'https://pelo-lite-five.vercel.app').replace(/\/$/, '');
  const pollUrl = `${cleanUrl}/api/bridge/poll?token=${encodeURIComponent(bridgeToken)}`;
  const ackUrl = `${cleanUrl}/api/bridge/ack`;
  const commandUrl = `${cleanUrl}/api/command`;

  return {
    profileName: 'Pelo Personal AI — Huawei P40 System Bridge',
    targetDevice: 'Huawei P40 (EMUI 12 / HarmonyOS · GMS-Free Ready)',
    version: '1.0.0',
    endpoints: {
      pollPendingCommands: pollUrl,
      acknowledgeExecuted: ackUrl,
      sendVoiceCommandFromPhone: commandUrl
    },
    emuiBatteryChecklist: [
      'Open Huawei Optimizer (Phone Manager) → App Launch',
      'Find MacroDroid → Switch OFF "Manage automatically"',
      'Enable all 3 toggles: Auto-launch, Secondary launch, Run in background',
      'Settings → Accessibility → Installed Services → Enable MacroDroid (for UI tap/lock/screenshot)'
    ],
    macrodroidMacro: {
      macroName: 'Pelo P40 Cloud Bridge',
      enabled: true,
      triggers: [
        {
          type: 'RegularIntervalTrigger',
          intervalSeconds: 5,
          note: 'Polls Pelo Queue every 5s while screen is on (or trigger instantly via Webhook)'
        }
      ],
      actions: [
        {
          step: 1,
          type: 'HttpRequestAction',
          method: 'GET',
          url: pollUrl,
          saveResponseToLocalVar: 'pelo_json'
        },
        {
          step: 2,
          type: 'JsonParseAction',
          sourceVar: 'pelo_json',
          mappings: {
            'commands[0].id': 'cmd_id',
            'commands[0].commandType': 'cmd_type',
            'commands[0].payload.value': 'cmd_val',
            'commands[0].payload.package': 'cmd_pkg'
          }
        },
        {
          step: 3,
          type: 'ConditionalDispatch',
          branches: [
            { when: 'cmd_type == "set_wifi"', action: 'SetWifiState(cmd_val)' },
            { when: 'cmd_type == "set_bluetooth"', action: 'SetBluetoothState(cmd_val)' },
            { when: 'cmd_type == "set_dnd"', action: 'SetPriorityMode(cmd_val)' },
            { when: 'cmd_type == "set_flashlight"', action: 'SetTorch(cmd_val)' },
            { when: 'cmd_type == "set_brightness"', action: 'SetScreenBrightness(cmd_val)' },
            { when: 'cmd_type == "set_volume"', action: 'SetVolume(Media, cmd_val)' },
            { when: 'cmd_type == "launch_package"', action: 'LaunchApplication(cmd_pkg)' },
            { when: 'cmd_type == "lock_screen"', action: 'ScreenOff()' },
            { when: 'cmd_type == "screenshot"', action: 'TakeScreenshot()' }
          ]
        },
        {
          step: 4,
          type: 'HttpRequestAction',
          method: 'POST',
          url: ackUrl,
          contentType: 'application/json',
          bodyTemplate: '{"token":"' + bridgeToken + '","ids":[{lv=cmd_id}]}'
        }
      ]
    }
  };
}

module.exports = {
  buildHuaweiP40BridgeProfile
};
