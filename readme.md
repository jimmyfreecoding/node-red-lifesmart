# Node-RED Lifesmart Gateway Integration

A specialized Node-RED node for integrating with Lifesmart brand local gateways. This node enables communication and control of Lifesmart smart home devices through their local gateway protocol.

## Features

- **Gateway Discovery**: Automatically discover Lifesmart gateways on the local network
- **Device Management**: Retrieve and control connected smart devices
- **Real-time Communication**: UDP-based communication with Lifesmart gateways
- **Device Control**: Send commands to control various Lifesmart devices including switches, sensors, and plugins
- **Multi-device Support**: Support for multiple device types including:
  - Smart switches (SL_SW_ND series)
  - Blinds/Curtains (SL_CN_IF, SL_P)
  - Human sensors (ZG#HE200_ZB, SL_SC_BM, SL_SC_CM)
  - Smart plugs (SL_OL_3C, SL_OE_W, SL_OL_W)

## Installation

### Via Node-RED Palette Manager
1. Open Node-RED in your browser
2. Go to Menu → Manage Palette
3. Click on the Install tab
4. Search for `geeqee-node-lifesmart`
5. Click Install

### Manual Installation
1. Navigate to your Node-RED user directory (usually `~/.node-red`)
2. Run the following command:
   ```bash
   npm install geeqee-node-lifesmart
   ```
3. Restart Node-RED

## Node Types

### Lifesmart In Node
Receives messages from Lifesmart gateways and devices.

**Configuration:**
- **Port**: UDP port to listen on
- **Multicast**: Enable/disable multicast listening
- **Interface**: Network interface to bind to
- **Output Format**: Choose between Buffer, UTF8 string, or Base64

**Output Messages:**
- `msg.payload`: Device data or gateway response
- `msg.ip`: Source IP address
- `msg.port`: Source port
- `msg.ssid`: Message type identifier

### Lifesmart Out Node
Sends commands to Lifesmart gateways and devices.

**Configuration:**
- **Address**: Target gateway IP address
- **Port**: Target UDP port (default: 12348)
- **Multicast**: Broadcast/multicast options
- **Local Port**: Local binding port

**Input Messages:**
- `msg.action`: Command type (`"gateways"`, `"devices"`, `"control"`)
- `msg.args`: Command arguments (for control actions)
- `msg.ip`: Target IP (overrides node configuration)
- `msg.port`: Target port (overrides node configuration)

## Usage Examples

### 1. Gateway Discovery
```javascript
// Send gateway discovery command
msg.action = "gateways";
return msg;
```

### 2. Device Discovery
```javascript
// Get all devices from gateway
msg.action = "devices";
return msg;
```

### 3. Device Control
```javascript
// Control a smart switch
msg.action = "control";
msg.args = {
    idx: "gateway_id",
    me: "device_id", 
    type: "P1",
    val: 1  // Turn on
};
return msg;
```

## Message Types

### Gateway Search Response
- `msg.ssid`: `"lifesmart_gateway_search"`
- `msg.payload`: JSON string containing gateway information

### Device List Response
- `msg.ssid`: `"lifesmart_device_search"`
- `msg.payload`: JSON string containing array of devices with formatted information

## Device Types Mapping

| Device Code | Type | Description |
|-------------|------|-------------|
| SL_SW_ND* | switch | Smart switches (1-3 gang) |
| SL_CN_IF, SL_P | blind | Curtain/blind controllers |
| ZG#HE200_ZB, SL_SC_BM, SL_SC_CM | humansensor | Motion/presence sensors |
| SL_OL_3C, SL_OE_W, SL_OL_W | plugin | Smart plugs |

## Protocol Details

The node communicates with Lifesmart gateways using a proprietary UDP protocol:
- **Port**: 12348 (default)
- **Format**: Binary protocol with JSON payload
- **Authentication**: MD5-signed requests with timestamp
- **Discovery**: Broadcast "Z-SEARCH" command

## File Structure

```
node-red-lifesmart/
├── geeqee-lifesmart.js      # Main node implementation
├── geeqee-lifesmart.html    # Node configuration UI
├── package.json             # Package configuration
├── locales/                 # Internationalization
│   └── zh-CN/
│       └── geeqee-node.json # Chinese translations
└── readme.md               # This file
```

## Building Package

To create a distributable package:

```bash
tar -zvcf lifesmart.tgz package/
```

## License

ISC License

## Support

For issues and feature requests, please refer to the project documentation or contact the maintainer.

## Version History

- **v2.0.0**: Current version with enhanced device support and improved protocol handling

