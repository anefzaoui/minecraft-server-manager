# Minecraft Server Manager

This context manages containerized Minecraft servers and their edition-specific runtime capabilities.

## Language

**Native Bedrock server**:
A Bedrock Dedicated Server managed as its own server runtime. It accepts Bedrock Edition clients directly over its game port.
_Avoid_: Geyser server, Bedrock/Geyser

**Server runtime**:
The edition-specific execution contract of a managed server. Java and native Bedrock runtimes use different containers, ports, and available capabilities.
_Avoid_: server type

**Geyser bridge**:
A component added to a Java Edition server that lets Bedrock Edition clients join that Java server. It is not a native Bedrock server.
_Avoid_: Bedrock server

**Geyser UDP port**:
The UDP port a Java server publishes for an installed Geyser bridge. It is unrelated to the ports of a native Bedrock server.
_Avoid_: Bedrock port

**NetherNet**:
The current Bedrock Dedicated Server transport. It uses a TCP signaling port and a configured range of UDP gameplay ports.
_Avoid_: single Bedrock UDP port

**RakNet**:
The legacy Bedrock Dedicated Server transport. It uses fixed UDP ports and is retained as a compatibility option.
