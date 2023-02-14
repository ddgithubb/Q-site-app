/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";

export const protobufPackage = "sync_server.v1";

export enum DeviceType {
  BROWSER = 0,
  DESKTOP = 1,
  MOBILE = 2,
  UNRECOGNIZED = -1,
}

export function deviceTypeFromJSON(object: any): DeviceType {
  switch (object) {
    case 0:
    case "BROWSER":
      return DeviceType.BROWSER;
    case 1:
    case "DESKTOP":
      return DeviceType.DESKTOP;
    case 2:
    case "MOBILE":
      return DeviceType.MOBILE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return DeviceType.UNRECOGNIZED;
  }
}

export function deviceTypeToJSON(object: DeviceType): string {
  switch (object) {
    case DeviceType.BROWSER:
      return "BROWSER";
    case DeviceType.DESKTOP:
      return "DESKTOP";
    case DeviceType.MOBILE:
      return "MOBILE";
    case DeviceType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface PoolBasicNode {
  nodeId: string;
  path: number[];
}

export interface PoolUserInfo {
  userId: string;
  displayName: string;
  devices: PoolDeviceInfo[];
}

export interface PoolDeviceInfo {
  deviceId: string;
  deviceType: DeviceType;
  deviceName: string;
}

/** Sync Server Message */
export interface SSMessage {
  op: SSMessage_Op;
  key: string;
  successResponseData?: SSMessage_SuccessResponseData | undefined;
  updateNodePositionData?: SSMessage_UpdateNodePositionData | undefined;
  connectNodeData?: SSMessage_ConnectNodeData | undefined;
  disconnectNodeData?: SSMessage_DisconnectNodeData | undefined;
  reportNodeData?: SSMessage_ReportNodeData | undefined;
  sdpOfferData?: SSMessage_SDPOfferData | undefined;
  sdpResponseData?: SSMessage_SDPResponseData | undefined;
  verifyNodeConnectedData?: SSMessage_VerifyNodeConnectedData | undefined;
  initPoolData?: SSMessage_InitPoolData | undefined;
  addNodeData?: SSMessage_AddNodeData | undefined;
  removeNodeData?: SSMessage_RemoveNodeData | undefined;
  updateUserData?: SSMessage_UpdateUserData | undefined;
  removeUserData?: SSMessage_RemoveUserData | undefined;
}

export enum SSMessage_Op {
  CLOSE = 0,
  HEARTBEAT = 1,
  UPDATE_NODE_POSITION = 2,
  CONNECT_NODE = 3,
  DISCONNECT_NODE = 4,
  REPORT_NODE = 5,
  SEND_OFFER = 6,
  ANSWER_OFFER = 7,
  VERIFY_NODE_CONNECTED = 8,
  INIT_POOL = 9,
  ADD_NODE = 10,
  REMOVE_NODE = 11,
  UPDATE_USER = 12,
  REMOVE_USER = 13,
  UNRECOGNIZED = -1,
}

export function sSMessage_OpFromJSON(object: any): SSMessage_Op {
  switch (object) {
    case 0:
    case "CLOSE":
      return SSMessage_Op.CLOSE;
    case 1:
    case "HEARTBEAT":
      return SSMessage_Op.HEARTBEAT;
    case 2:
    case "UPDATE_NODE_POSITION":
      return SSMessage_Op.UPDATE_NODE_POSITION;
    case 3:
    case "CONNECT_NODE":
      return SSMessage_Op.CONNECT_NODE;
    case 4:
    case "DISCONNECT_NODE":
      return SSMessage_Op.DISCONNECT_NODE;
    case 5:
    case "REPORT_NODE":
      return SSMessage_Op.REPORT_NODE;
    case 6:
    case "SEND_OFFER":
      return SSMessage_Op.SEND_OFFER;
    case 7:
    case "ANSWER_OFFER":
      return SSMessage_Op.ANSWER_OFFER;
    case 8:
    case "VERIFY_NODE_CONNECTED":
      return SSMessage_Op.VERIFY_NODE_CONNECTED;
    case 9:
    case "INIT_POOL":
      return SSMessage_Op.INIT_POOL;
    case 10:
    case "ADD_NODE":
      return SSMessage_Op.ADD_NODE;
    case 11:
    case "REMOVE_NODE":
      return SSMessage_Op.REMOVE_NODE;
    case 12:
    case "UPDATE_USER":
      return SSMessage_Op.UPDATE_USER;
    case 13:
    case "REMOVE_USER":
      return SSMessage_Op.REMOVE_USER;
    case -1:
    case "UNRECOGNIZED":
    default:
      return SSMessage_Op.UNRECOGNIZED;
  }
}

export function sSMessage_OpToJSON(object: SSMessage_Op): string {
  switch (object) {
    case SSMessage_Op.CLOSE:
      return "CLOSE";
    case SSMessage_Op.HEARTBEAT:
      return "HEARTBEAT";
    case SSMessage_Op.UPDATE_NODE_POSITION:
      return "UPDATE_NODE_POSITION";
    case SSMessage_Op.CONNECT_NODE:
      return "CONNECT_NODE";
    case SSMessage_Op.DISCONNECT_NODE:
      return "DISCONNECT_NODE";
    case SSMessage_Op.REPORT_NODE:
      return "REPORT_NODE";
    case SSMessage_Op.SEND_OFFER:
      return "SEND_OFFER";
    case SSMessage_Op.ANSWER_OFFER:
      return "ANSWER_OFFER";
    case SSMessage_Op.VERIFY_NODE_CONNECTED:
      return "VERIFY_NODE_CONNECTED";
    case SSMessage_Op.INIT_POOL:
      return "INIT_POOL";
    case SSMessage_Op.ADD_NODE:
      return "ADD_NODE";
    case SSMessage_Op.REMOVE_NODE:
      return "REMOVE_NODE";
    case SSMessage_Op.UPDATE_USER:
      return "UPDATE_USER";
    case SSMessage_Op.REMOVE_USER:
      return "REMOVE_USER";
    case SSMessage_Op.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum SSMessage_ReportCode {
  DISCONNECT_REPORT = 0,
  UNRECOGNIZED = -1,
}

export function sSMessage_ReportCodeFromJSON(object: any): SSMessage_ReportCode {
  switch (object) {
    case 0:
    case "DISCONNECT_REPORT":
      return SSMessage_ReportCode.DISCONNECT_REPORT;
    case -1:
    case "UNRECOGNIZED":
    default:
      return SSMessage_ReportCode.UNRECOGNIZED;
  }
}

export function sSMessage_ReportCodeToJSON(object: SSMessage_ReportCode): string {
  switch (object) {
    case SSMessage_ReportCode.DISCONNECT_REPORT:
      return "DISCONNECT_REPORT";
    case SSMessage_ReportCode.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface SSMessage_SuccessResponseData {
  success: boolean;
}

export interface SSMessage_UpdateNodePositionData {
  path: number[];
  partnerInt: number;
  centerCluster: boolean;
  parentClusterNodeIds: string[];
  childClusterNodeIds: string[];
}

export interface SSMessage_ConnectNodeData {
  nodeId: string;
}

export interface SSMessage_DisconnectNodeData {
  nodeId: string;
}

export interface SSMessage_ReportNodeData {
  nodeId: string;
  reportCode: SSMessage_ReportCode;
}

export interface SSMessage_SDPOfferData {
  fromNodeId: string;
  sdp: string;
}

export interface SSMessage_SDPResponseData {
  sdp: string;
  success: boolean;
}

export interface SSMessage_VerifyNodeConnectedData {
  nodeId: string;
}

export interface SSMessage_InitPoolData {
  myNode: SSMessage_AddNodeData | undefined;
  initNodes: SSMessage_AddNodeData[];
  updateUsers: SSMessage_UpdateUserData[];
}

export interface SSMessage_AddNodeData {
  nodeId: string;
  userId: string;
  deviceId: string;
  path: number[];
  timestamp: number;
}

export interface SSMessage_RemoveNodeData {
  nodeId: string;
  timestamp: number;
  promotedNodes: PoolBasicNode[];
}

export interface SSMessage_UpdateUserData {
  userInfo: PoolUserInfo | undefined;
}

export interface SSMessage_RemoveUserData {
  userId: string;
}

function createBasePoolBasicNode(): PoolBasicNode {
  return { nodeId: "", path: [] };
}

export const PoolBasicNode = {
  encode(message: PoolBasicNode, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    writer.uint32(18).fork();
    for (const v of message.path) {
      writer.uint32(v);
    }
    writer.ldelim();
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolBasicNode {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolBasicNode();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        case 2:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.path.push(reader.uint32());
            }
          } else {
            message.path.push(reader.uint32());
          }
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolBasicNode {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      path: Array.isArray(object?.path) ? object.path.map((e: any) => Number(e)) : [],
    };
  },

  toJSON(message: PoolBasicNode): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    if (message.path) {
      obj.path = message.path.map((e) => Math.round(e));
    } else {
      obj.path = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolBasicNode>, I>>(object: I): PoolBasicNode {
    const message = createBasePoolBasicNode();
    message.nodeId = object.nodeId ?? "";
    message.path = object.path?.map((e) => e) || [];
    return message;
  },
};

function createBasePoolUserInfo(): PoolUserInfo {
  return { userId: "", displayName: "", devices: [] };
}

export const PoolUserInfo = {
  encode(message: PoolUserInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userId !== "") {
      writer.uint32(10).string(message.userId);
    }
    if (message.displayName !== "") {
      writer.uint32(18).string(message.displayName);
    }
    for (const v of message.devices) {
      PoolDeviceInfo.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolUserInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolUserInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userId = reader.string();
          break;
        case 2:
          message.displayName = reader.string();
          break;
        case 3:
          message.devices.push(PoolDeviceInfo.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolUserInfo {
    return {
      userId: isSet(object.userId) ? String(object.userId) : "",
      displayName: isSet(object.displayName) ? String(object.displayName) : "",
      devices: Array.isArray(object?.devices) ? object.devices.map((e: any) => PoolDeviceInfo.fromJSON(e)) : [],
    };
  },

  toJSON(message: PoolUserInfo): unknown {
    const obj: any = {};
    message.userId !== undefined && (obj.userId = message.userId);
    message.displayName !== undefined && (obj.displayName = message.displayName);
    if (message.devices) {
      obj.devices = message.devices.map((e) => e ? PoolDeviceInfo.toJSON(e) : undefined);
    } else {
      obj.devices = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolUserInfo>, I>>(object: I): PoolUserInfo {
    const message = createBasePoolUserInfo();
    message.userId = object.userId ?? "";
    message.displayName = object.displayName ?? "";
    message.devices = object.devices?.map((e) => PoolDeviceInfo.fromPartial(e)) || [];
    return message;
  },
};

function createBasePoolDeviceInfo(): PoolDeviceInfo {
  return { deviceId: "", deviceType: 0, deviceName: "" };
}

export const PoolDeviceInfo = {
  encode(message: PoolDeviceInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.deviceId !== "") {
      writer.uint32(10).string(message.deviceId);
    }
    if (message.deviceType !== 0) {
      writer.uint32(16).int32(message.deviceType);
    }
    if (message.deviceName !== "") {
      writer.uint32(26).string(message.deviceName);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolDeviceInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolDeviceInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.deviceId = reader.string();
          break;
        case 2:
          message.deviceType = reader.int32() as any;
          break;
        case 3:
          message.deviceName = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolDeviceInfo {
    return {
      deviceId: isSet(object.deviceId) ? String(object.deviceId) : "",
      deviceType: isSet(object.deviceType) ? deviceTypeFromJSON(object.deviceType) : 0,
      deviceName: isSet(object.deviceName) ? String(object.deviceName) : "",
    };
  },

  toJSON(message: PoolDeviceInfo): unknown {
    const obj: any = {};
    message.deviceId !== undefined && (obj.deviceId = message.deviceId);
    message.deviceType !== undefined && (obj.deviceType = deviceTypeToJSON(message.deviceType));
    message.deviceName !== undefined && (obj.deviceName = message.deviceName);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolDeviceInfo>, I>>(object: I): PoolDeviceInfo {
    const message = createBasePoolDeviceInfo();
    message.deviceId = object.deviceId ?? "";
    message.deviceType = object.deviceType ?? 0;
    message.deviceName = object.deviceName ?? "";
    return message;
  },
};

function createBaseSSMessage(): SSMessage {
  return {
    op: 0,
    key: "",
    successResponseData: undefined,
    updateNodePositionData: undefined,
    connectNodeData: undefined,
    disconnectNodeData: undefined,
    reportNodeData: undefined,
    sdpOfferData: undefined,
    sdpResponseData: undefined,
    verifyNodeConnectedData: undefined,
    initPoolData: undefined,
    addNodeData: undefined,
    removeNodeData: undefined,
    updateUserData: undefined,
    removeUserData: undefined,
  };
}

export const SSMessage = {
  encode(message: SSMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.op !== 0) {
      writer.uint32(8).int32(message.op);
    }
    if (message.key !== "") {
      writer.uint32(18).string(message.key);
    }
    if (message.successResponseData !== undefined) {
      SSMessage_SuccessResponseData.encode(message.successResponseData, writer.uint32(26).fork()).ldelim();
    }
    if (message.updateNodePositionData !== undefined) {
      SSMessage_UpdateNodePositionData.encode(message.updateNodePositionData, writer.uint32(34).fork()).ldelim();
    }
    if (message.connectNodeData !== undefined) {
      SSMessage_ConnectNodeData.encode(message.connectNodeData, writer.uint32(42).fork()).ldelim();
    }
    if (message.disconnectNodeData !== undefined) {
      SSMessage_DisconnectNodeData.encode(message.disconnectNodeData, writer.uint32(50).fork()).ldelim();
    }
    if (message.reportNodeData !== undefined) {
      SSMessage_ReportNodeData.encode(message.reportNodeData, writer.uint32(58).fork()).ldelim();
    }
    if (message.sdpOfferData !== undefined) {
      SSMessage_SDPOfferData.encode(message.sdpOfferData, writer.uint32(66).fork()).ldelim();
    }
    if (message.sdpResponseData !== undefined) {
      SSMessage_SDPResponseData.encode(message.sdpResponseData, writer.uint32(74).fork()).ldelim();
    }
    if (message.verifyNodeConnectedData !== undefined) {
      SSMessage_VerifyNodeConnectedData.encode(message.verifyNodeConnectedData, writer.uint32(82).fork()).ldelim();
    }
    if (message.initPoolData !== undefined) {
      SSMessage_InitPoolData.encode(message.initPoolData, writer.uint32(90).fork()).ldelim();
    }
    if (message.addNodeData !== undefined) {
      SSMessage_AddNodeData.encode(message.addNodeData, writer.uint32(98).fork()).ldelim();
    }
    if (message.removeNodeData !== undefined) {
      SSMessage_RemoveNodeData.encode(message.removeNodeData, writer.uint32(106).fork()).ldelim();
    }
    if (message.updateUserData !== undefined) {
      SSMessage_UpdateUserData.encode(message.updateUserData, writer.uint32(114).fork()).ldelim();
    }
    if (message.removeUserData !== undefined) {
      SSMessage_RemoveUserData.encode(message.removeUserData, writer.uint32(122).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.op = reader.int32() as any;
          break;
        case 2:
          message.key = reader.string();
          break;
        case 3:
          message.successResponseData = SSMessage_SuccessResponseData.decode(reader, reader.uint32());
          break;
        case 4:
          message.updateNodePositionData = SSMessage_UpdateNodePositionData.decode(reader, reader.uint32());
          break;
        case 5:
          message.connectNodeData = SSMessage_ConnectNodeData.decode(reader, reader.uint32());
          break;
        case 6:
          message.disconnectNodeData = SSMessage_DisconnectNodeData.decode(reader, reader.uint32());
          break;
        case 7:
          message.reportNodeData = SSMessage_ReportNodeData.decode(reader, reader.uint32());
          break;
        case 8:
          message.sdpOfferData = SSMessage_SDPOfferData.decode(reader, reader.uint32());
          break;
        case 9:
          message.sdpResponseData = SSMessage_SDPResponseData.decode(reader, reader.uint32());
          break;
        case 10:
          message.verifyNodeConnectedData = SSMessage_VerifyNodeConnectedData.decode(reader, reader.uint32());
          break;
        case 11:
          message.initPoolData = SSMessage_InitPoolData.decode(reader, reader.uint32());
          break;
        case 12:
          message.addNodeData = SSMessage_AddNodeData.decode(reader, reader.uint32());
          break;
        case 13:
          message.removeNodeData = SSMessage_RemoveNodeData.decode(reader, reader.uint32());
          break;
        case 14:
          message.updateUserData = SSMessage_UpdateUserData.decode(reader, reader.uint32());
          break;
        case 15:
          message.removeUserData = SSMessage_RemoveUserData.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage {
    return {
      op: isSet(object.op) ? sSMessage_OpFromJSON(object.op) : 0,
      key: isSet(object.key) ? String(object.key) : "",
      successResponseData: isSet(object.successResponseData)
        ? SSMessage_SuccessResponseData.fromJSON(object.successResponseData)
        : undefined,
      updateNodePositionData: isSet(object.updateNodePositionData)
        ? SSMessage_UpdateNodePositionData.fromJSON(object.updateNodePositionData)
        : undefined,
      connectNodeData: isSet(object.connectNodeData)
        ? SSMessage_ConnectNodeData.fromJSON(object.connectNodeData)
        : undefined,
      disconnectNodeData: isSet(object.disconnectNodeData)
        ? SSMessage_DisconnectNodeData.fromJSON(object.disconnectNodeData)
        : undefined,
      reportNodeData: isSet(object.reportNodeData)
        ? SSMessage_ReportNodeData.fromJSON(object.reportNodeData)
        : undefined,
      sdpOfferData: isSet(object.sdpOfferData) ? SSMessage_SDPOfferData.fromJSON(object.sdpOfferData) : undefined,
      sdpResponseData: isSet(object.sdpResponseData)
        ? SSMessage_SDPResponseData.fromJSON(object.sdpResponseData)
        : undefined,
      verifyNodeConnectedData: isSet(object.verifyNodeConnectedData)
        ? SSMessage_VerifyNodeConnectedData.fromJSON(object.verifyNodeConnectedData)
        : undefined,
      initPoolData: isSet(object.initPoolData) ? SSMessage_InitPoolData.fromJSON(object.initPoolData) : undefined,
      addNodeData: isSet(object.addNodeData) ? SSMessage_AddNodeData.fromJSON(object.addNodeData) : undefined,
      removeNodeData: isSet(object.removeNodeData)
        ? SSMessage_RemoveNodeData.fromJSON(object.removeNodeData)
        : undefined,
      updateUserData: isSet(object.updateUserData)
        ? SSMessage_UpdateUserData.fromJSON(object.updateUserData)
        : undefined,
      removeUserData: isSet(object.removeUserData)
        ? SSMessage_RemoveUserData.fromJSON(object.removeUserData)
        : undefined,
    };
  },

  toJSON(message: SSMessage): unknown {
    const obj: any = {};
    message.op !== undefined && (obj.op = sSMessage_OpToJSON(message.op));
    message.key !== undefined && (obj.key = message.key);
    message.successResponseData !== undefined && (obj.successResponseData = message.successResponseData
      ? SSMessage_SuccessResponseData.toJSON(message.successResponseData)
      : undefined);
    message.updateNodePositionData !== undefined && (obj.updateNodePositionData = message.updateNodePositionData
      ? SSMessage_UpdateNodePositionData.toJSON(message.updateNodePositionData)
      : undefined);
    message.connectNodeData !== undefined && (obj.connectNodeData = message.connectNodeData
      ? SSMessage_ConnectNodeData.toJSON(message.connectNodeData)
      : undefined);
    message.disconnectNodeData !== undefined && (obj.disconnectNodeData = message.disconnectNodeData
      ? SSMessage_DisconnectNodeData.toJSON(message.disconnectNodeData)
      : undefined);
    message.reportNodeData !== undefined &&
      (obj.reportNodeData = message.reportNodeData
        ? SSMessage_ReportNodeData.toJSON(message.reportNodeData)
        : undefined);
    message.sdpOfferData !== undefined &&
      (obj.sdpOfferData = message.sdpOfferData ? SSMessage_SDPOfferData.toJSON(message.sdpOfferData) : undefined);
    message.sdpResponseData !== undefined && (obj.sdpResponseData = message.sdpResponseData
      ? SSMessage_SDPResponseData.toJSON(message.sdpResponseData)
      : undefined);
    message.verifyNodeConnectedData !== undefined && (obj.verifyNodeConnectedData = message.verifyNodeConnectedData
      ? SSMessage_VerifyNodeConnectedData.toJSON(message.verifyNodeConnectedData)
      : undefined);
    message.initPoolData !== undefined &&
      (obj.initPoolData = message.initPoolData ? SSMessage_InitPoolData.toJSON(message.initPoolData) : undefined);
    message.addNodeData !== undefined &&
      (obj.addNodeData = message.addNodeData ? SSMessage_AddNodeData.toJSON(message.addNodeData) : undefined);
    message.removeNodeData !== undefined &&
      (obj.removeNodeData = message.removeNodeData
        ? SSMessage_RemoveNodeData.toJSON(message.removeNodeData)
        : undefined);
    message.updateUserData !== undefined &&
      (obj.updateUserData = message.updateUserData
        ? SSMessage_UpdateUserData.toJSON(message.updateUserData)
        : undefined);
    message.removeUserData !== undefined &&
      (obj.removeUserData = message.removeUserData
        ? SSMessage_RemoveUserData.toJSON(message.removeUserData)
        : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage>, I>>(object: I): SSMessage {
    const message = createBaseSSMessage();
    message.op = object.op ?? 0;
    message.key = object.key ?? "";
    message.successResponseData = (object.successResponseData !== undefined && object.successResponseData !== null)
      ? SSMessage_SuccessResponseData.fromPartial(object.successResponseData)
      : undefined;
    message.updateNodePositionData =
      (object.updateNodePositionData !== undefined && object.updateNodePositionData !== null)
        ? SSMessage_UpdateNodePositionData.fromPartial(object.updateNodePositionData)
        : undefined;
    message.connectNodeData = (object.connectNodeData !== undefined && object.connectNodeData !== null)
      ? SSMessage_ConnectNodeData.fromPartial(object.connectNodeData)
      : undefined;
    message.disconnectNodeData = (object.disconnectNodeData !== undefined && object.disconnectNodeData !== null)
      ? SSMessage_DisconnectNodeData.fromPartial(object.disconnectNodeData)
      : undefined;
    message.reportNodeData = (object.reportNodeData !== undefined && object.reportNodeData !== null)
      ? SSMessage_ReportNodeData.fromPartial(object.reportNodeData)
      : undefined;
    message.sdpOfferData = (object.sdpOfferData !== undefined && object.sdpOfferData !== null)
      ? SSMessage_SDPOfferData.fromPartial(object.sdpOfferData)
      : undefined;
    message.sdpResponseData = (object.sdpResponseData !== undefined && object.sdpResponseData !== null)
      ? SSMessage_SDPResponseData.fromPartial(object.sdpResponseData)
      : undefined;
    message.verifyNodeConnectedData =
      (object.verifyNodeConnectedData !== undefined && object.verifyNodeConnectedData !== null)
        ? SSMessage_VerifyNodeConnectedData.fromPartial(object.verifyNodeConnectedData)
        : undefined;
    message.initPoolData = (object.initPoolData !== undefined && object.initPoolData !== null)
      ? SSMessage_InitPoolData.fromPartial(object.initPoolData)
      : undefined;
    message.addNodeData = (object.addNodeData !== undefined && object.addNodeData !== null)
      ? SSMessage_AddNodeData.fromPartial(object.addNodeData)
      : undefined;
    message.removeNodeData = (object.removeNodeData !== undefined && object.removeNodeData !== null)
      ? SSMessage_RemoveNodeData.fromPartial(object.removeNodeData)
      : undefined;
    message.updateUserData = (object.updateUserData !== undefined && object.updateUserData !== null)
      ? SSMessage_UpdateUserData.fromPartial(object.updateUserData)
      : undefined;
    message.removeUserData = (object.removeUserData !== undefined && object.removeUserData !== null)
      ? SSMessage_RemoveUserData.fromPartial(object.removeUserData)
      : undefined;
    return message;
  },
};

function createBaseSSMessage_SuccessResponseData(): SSMessage_SuccessResponseData {
  return { success: false };
}

export const SSMessage_SuccessResponseData = {
  encode(message: SSMessage_SuccessResponseData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.success === true) {
      writer.uint32(8).bool(message.success);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_SuccessResponseData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_SuccessResponseData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.success = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_SuccessResponseData {
    return { success: isSet(object.success) ? Boolean(object.success) : false };
  },

  toJSON(message: SSMessage_SuccessResponseData): unknown {
    const obj: any = {};
    message.success !== undefined && (obj.success = message.success);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_SuccessResponseData>, I>>(
    object: I,
  ): SSMessage_SuccessResponseData {
    const message = createBaseSSMessage_SuccessResponseData();
    message.success = object.success ?? false;
    return message;
  },
};

function createBaseSSMessage_UpdateNodePositionData(): SSMessage_UpdateNodePositionData {
  return { path: [], partnerInt: 0, centerCluster: false, parentClusterNodeIds: [], childClusterNodeIds: [] };
}

export const SSMessage_UpdateNodePositionData = {
  encode(message: SSMessage_UpdateNodePositionData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    writer.uint32(10).fork();
    for (const v of message.path) {
      writer.uint32(v);
    }
    writer.ldelim();
    if (message.partnerInt !== 0) {
      writer.uint32(16).uint32(message.partnerInt);
    }
    if (message.centerCluster === true) {
      writer.uint32(24).bool(message.centerCluster);
    }
    for (const v of message.parentClusterNodeIds) {
      writer.uint32(34).string(v!);
    }
    for (const v of message.childClusterNodeIds) {
      writer.uint32(42).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_UpdateNodePositionData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_UpdateNodePositionData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.path.push(reader.uint32());
            }
          } else {
            message.path.push(reader.uint32());
          }
          break;
        case 2:
          message.partnerInt = reader.uint32();
          break;
        case 3:
          message.centerCluster = reader.bool();
          break;
        case 4:
          message.parentClusterNodeIds.push(reader.string());
          break;
        case 5:
          message.childClusterNodeIds.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_UpdateNodePositionData {
    return {
      path: Array.isArray(object?.path) ? object.path.map((e: any) => Number(e)) : [],
      partnerInt: isSet(object.partnerInt) ? Number(object.partnerInt) : 0,
      centerCluster: isSet(object.centerCluster) ? Boolean(object.centerCluster) : false,
      parentClusterNodeIds: Array.isArray(object?.parentClusterNodeIds)
        ? object.parentClusterNodeIds.map((e: any) => String(e))
        : [],
      childClusterNodeIds: Array.isArray(object?.childClusterNodeIds)
        ? object.childClusterNodeIds.map((e: any) => String(e))
        : [],
    };
  },

  toJSON(message: SSMessage_UpdateNodePositionData): unknown {
    const obj: any = {};
    if (message.path) {
      obj.path = message.path.map((e) => Math.round(e));
    } else {
      obj.path = [];
    }
    message.partnerInt !== undefined && (obj.partnerInt = Math.round(message.partnerInt));
    message.centerCluster !== undefined && (obj.centerCluster = message.centerCluster);
    if (message.parentClusterNodeIds) {
      obj.parentClusterNodeIds = message.parentClusterNodeIds.map((e) => e);
    } else {
      obj.parentClusterNodeIds = [];
    }
    if (message.childClusterNodeIds) {
      obj.childClusterNodeIds = message.childClusterNodeIds.map((e) => e);
    } else {
      obj.childClusterNodeIds = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_UpdateNodePositionData>, I>>(
    object: I,
  ): SSMessage_UpdateNodePositionData {
    const message = createBaseSSMessage_UpdateNodePositionData();
    message.path = object.path?.map((e) => e) || [];
    message.partnerInt = object.partnerInt ?? 0;
    message.centerCluster = object.centerCluster ?? false;
    message.parentClusterNodeIds = object.parentClusterNodeIds?.map((e) => e) || [];
    message.childClusterNodeIds = object.childClusterNodeIds?.map((e) => e) || [];
    return message;
  },
};

function createBaseSSMessage_ConnectNodeData(): SSMessage_ConnectNodeData {
  return { nodeId: "" };
}

export const SSMessage_ConnectNodeData = {
  encode(message: SSMessage_ConnectNodeData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_ConnectNodeData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_ConnectNodeData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_ConnectNodeData {
    return { nodeId: isSet(object.nodeId) ? String(object.nodeId) : "" };
  },

  toJSON(message: SSMessage_ConnectNodeData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_ConnectNodeData>, I>>(object: I): SSMessage_ConnectNodeData {
    const message = createBaseSSMessage_ConnectNodeData();
    message.nodeId = object.nodeId ?? "";
    return message;
  },
};

function createBaseSSMessage_DisconnectNodeData(): SSMessage_DisconnectNodeData {
  return { nodeId: "" };
}

export const SSMessage_DisconnectNodeData = {
  encode(message: SSMessage_DisconnectNodeData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_DisconnectNodeData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_DisconnectNodeData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_DisconnectNodeData {
    return { nodeId: isSet(object.nodeId) ? String(object.nodeId) : "" };
  },

  toJSON(message: SSMessage_DisconnectNodeData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_DisconnectNodeData>, I>>(object: I): SSMessage_DisconnectNodeData {
    const message = createBaseSSMessage_DisconnectNodeData();
    message.nodeId = object.nodeId ?? "";
    return message;
  },
};

function createBaseSSMessage_ReportNodeData(): SSMessage_ReportNodeData {
  return { nodeId: "", reportCode: 0 };
}

export const SSMessage_ReportNodeData = {
  encode(message: SSMessage_ReportNodeData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    if (message.reportCode !== 0) {
      writer.uint32(16).int32(message.reportCode);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_ReportNodeData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_ReportNodeData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        case 2:
          message.reportCode = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_ReportNodeData {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      reportCode: isSet(object.reportCode) ? sSMessage_ReportCodeFromJSON(object.reportCode) : 0,
    };
  },

  toJSON(message: SSMessage_ReportNodeData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    message.reportCode !== undefined && (obj.reportCode = sSMessage_ReportCodeToJSON(message.reportCode));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_ReportNodeData>, I>>(object: I): SSMessage_ReportNodeData {
    const message = createBaseSSMessage_ReportNodeData();
    message.nodeId = object.nodeId ?? "";
    message.reportCode = object.reportCode ?? 0;
    return message;
  },
};

function createBaseSSMessage_SDPOfferData(): SSMessage_SDPOfferData {
  return { fromNodeId: "", sdp: "" };
}

export const SSMessage_SDPOfferData = {
  encode(message: SSMessage_SDPOfferData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fromNodeId !== "") {
      writer.uint32(10).string(message.fromNodeId);
    }
    if (message.sdp !== "") {
      writer.uint32(18).string(message.sdp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_SDPOfferData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_SDPOfferData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fromNodeId = reader.string();
          break;
        case 2:
          message.sdp = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_SDPOfferData {
    return {
      fromNodeId: isSet(object.fromNodeId) ? String(object.fromNodeId) : "",
      sdp: isSet(object.sdp) ? String(object.sdp) : "",
    };
  },

  toJSON(message: SSMessage_SDPOfferData): unknown {
    const obj: any = {};
    message.fromNodeId !== undefined && (obj.fromNodeId = message.fromNodeId);
    message.sdp !== undefined && (obj.sdp = message.sdp);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_SDPOfferData>, I>>(object: I): SSMessage_SDPOfferData {
    const message = createBaseSSMessage_SDPOfferData();
    message.fromNodeId = object.fromNodeId ?? "";
    message.sdp = object.sdp ?? "";
    return message;
  },
};

function createBaseSSMessage_SDPResponseData(): SSMessage_SDPResponseData {
  return { sdp: "", success: false };
}

export const SSMessage_SDPResponseData = {
  encode(message: SSMessage_SDPResponseData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.sdp !== "") {
      writer.uint32(10).string(message.sdp);
    }
    if (message.success === true) {
      writer.uint32(16).bool(message.success);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_SDPResponseData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_SDPResponseData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sdp = reader.string();
          break;
        case 2:
          message.success = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_SDPResponseData {
    return {
      sdp: isSet(object.sdp) ? String(object.sdp) : "",
      success: isSet(object.success) ? Boolean(object.success) : false,
    };
  },

  toJSON(message: SSMessage_SDPResponseData): unknown {
    const obj: any = {};
    message.sdp !== undefined && (obj.sdp = message.sdp);
    message.success !== undefined && (obj.success = message.success);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_SDPResponseData>, I>>(object: I): SSMessage_SDPResponseData {
    const message = createBaseSSMessage_SDPResponseData();
    message.sdp = object.sdp ?? "";
    message.success = object.success ?? false;
    return message;
  },
};

function createBaseSSMessage_VerifyNodeConnectedData(): SSMessage_VerifyNodeConnectedData {
  return { nodeId: "" };
}

export const SSMessage_VerifyNodeConnectedData = {
  encode(message: SSMessage_VerifyNodeConnectedData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_VerifyNodeConnectedData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_VerifyNodeConnectedData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_VerifyNodeConnectedData {
    return { nodeId: isSet(object.nodeId) ? String(object.nodeId) : "" };
  },

  toJSON(message: SSMessage_VerifyNodeConnectedData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_VerifyNodeConnectedData>, I>>(
    object: I,
  ): SSMessage_VerifyNodeConnectedData {
    const message = createBaseSSMessage_VerifyNodeConnectedData();
    message.nodeId = object.nodeId ?? "";
    return message;
  },
};

function createBaseSSMessage_InitPoolData(): SSMessage_InitPoolData {
  return { myNode: undefined, initNodes: [], updateUsers: [] };
}

export const SSMessage_InitPoolData = {
  encode(message: SSMessage_InitPoolData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.myNode !== undefined) {
      SSMessage_AddNodeData.encode(message.myNode, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.initNodes) {
      SSMessage_AddNodeData.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.updateUsers) {
      SSMessage_UpdateUserData.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_InitPoolData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_InitPoolData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.myNode = SSMessage_AddNodeData.decode(reader, reader.uint32());
          break;
        case 2:
          message.initNodes.push(SSMessage_AddNodeData.decode(reader, reader.uint32()));
          break;
        case 3:
          message.updateUsers.push(SSMessage_UpdateUserData.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_InitPoolData {
    return {
      myNode: isSet(object.myNode) ? SSMessage_AddNodeData.fromJSON(object.myNode) : undefined,
      initNodes: Array.isArray(object?.initNodes)
        ? object.initNodes.map((e: any) => SSMessage_AddNodeData.fromJSON(e))
        : [],
      updateUsers: Array.isArray(object?.updateUsers)
        ? object.updateUsers.map((e: any) => SSMessage_UpdateUserData.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SSMessage_InitPoolData): unknown {
    const obj: any = {};
    message.myNode !== undefined &&
      (obj.myNode = message.myNode ? SSMessage_AddNodeData.toJSON(message.myNode) : undefined);
    if (message.initNodes) {
      obj.initNodes = message.initNodes.map((e) => e ? SSMessage_AddNodeData.toJSON(e) : undefined);
    } else {
      obj.initNodes = [];
    }
    if (message.updateUsers) {
      obj.updateUsers = message.updateUsers.map((e) => e ? SSMessage_UpdateUserData.toJSON(e) : undefined);
    } else {
      obj.updateUsers = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_InitPoolData>, I>>(object: I): SSMessage_InitPoolData {
    const message = createBaseSSMessage_InitPoolData();
    message.myNode = (object.myNode !== undefined && object.myNode !== null)
      ? SSMessage_AddNodeData.fromPartial(object.myNode)
      : undefined;
    message.initNodes = object.initNodes?.map((e) => SSMessage_AddNodeData.fromPartial(e)) || [];
    message.updateUsers = object.updateUsers?.map((e) => SSMessage_UpdateUserData.fromPartial(e)) || [];
    return message;
  },
};

function createBaseSSMessage_AddNodeData(): SSMessage_AddNodeData {
  return { nodeId: "", userId: "", deviceId: "", path: [], timestamp: 0 };
}

export const SSMessage_AddNodeData = {
  encode(message: SSMessage_AddNodeData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    if (message.userId !== "") {
      writer.uint32(18).string(message.userId);
    }
    if (message.deviceId !== "") {
      writer.uint32(26).string(message.deviceId);
    }
    writer.uint32(34).fork();
    for (const v of message.path) {
      writer.uint32(v);
    }
    writer.ldelim();
    if (message.timestamp !== 0) {
      writer.uint32(40).uint64(message.timestamp);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_AddNodeData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_AddNodeData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        case 2:
          message.userId = reader.string();
          break;
        case 3:
          message.deviceId = reader.string();
          break;
        case 4:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.path.push(reader.uint32());
            }
          } else {
            message.path.push(reader.uint32());
          }
          break;
        case 5:
          message.timestamp = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_AddNodeData {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      userId: isSet(object.userId) ? String(object.userId) : "",
      deviceId: isSet(object.deviceId) ? String(object.deviceId) : "",
      path: Array.isArray(object?.path) ? object.path.map((e: any) => Number(e)) : [],
      timestamp: isSet(object.timestamp) ? Number(object.timestamp) : 0,
    };
  },

  toJSON(message: SSMessage_AddNodeData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    message.userId !== undefined && (obj.userId = message.userId);
    message.deviceId !== undefined && (obj.deviceId = message.deviceId);
    if (message.path) {
      obj.path = message.path.map((e) => Math.round(e));
    } else {
      obj.path = [];
    }
    message.timestamp !== undefined && (obj.timestamp = Math.round(message.timestamp));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_AddNodeData>, I>>(object: I): SSMessage_AddNodeData {
    const message = createBaseSSMessage_AddNodeData();
    message.nodeId = object.nodeId ?? "";
    message.userId = object.userId ?? "";
    message.deviceId = object.deviceId ?? "";
    message.path = object.path?.map((e) => e) || [];
    message.timestamp = object.timestamp ?? 0;
    return message;
  },
};

function createBaseSSMessage_RemoveNodeData(): SSMessage_RemoveNodeData {
  return { nodeId: "", timestamp: 0, promotedNodes: [] };
}

export const SSMessage_RemoveNodeData = {
  encode(message: SSMessage_RemoveNodeData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    if (message.timestamp !== 0) {
      writer.uint32(16).uint64(message.timestamp);
    }
    for (const v of message.promotedNodes) {
      PoolBasicNode.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_RemoveNodeData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_RemoveNodeData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        case 2:
          message.timestamp = longToNumber(reader.uint64() as Long);
          break;
        case 3:
          message.promotedNodes.push(PoolBasicNode.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_RemoveNodeData {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      timestamp: isSet(object.timestamp) ? Number(object.timestamp) : 0,
      promotedNodes: Array.isArray(object?.promotedNodes)
        ? object.promotedNodes.map((e: any) => PoolBasicNode.fromJSON(e))
        : [],
    };
  },

  toJSON(message: SSMessage_RemoveNodeData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    message.timestamp !== undefined && (obj.timestamp = Math.round(message.timestamp));
    if (message.promotedNodes) {
      obj.promotedNodes = message.promotedNodes.map((e) => e ? PoolBasicNode.toJSON(e) : undefined);
    } else {
      obj.promotedNodes = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_RemoveNodeData>, I>>(object: I): SSMessage_RemoveNodeData {
    const message = createBaseSSMessage_RemoveNodeData();
    message.nodeId = object.nodeId ?? "";
    message.timestamp = object.timestamp ?? 0;
    message.promotedNodes = object.promotedNodes?.map((e) => PoolBasicNode.fromPartial(e)) || [];
    return message;
  },
};

function createBaseSSMessage_UpdateUserData(): SSMessage_UpdateUserData {
  return { userInfo: undefined };
}

export const SSMessage_UpdateUserData = {
  encode(message: SSMessage_UpdateUserData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userInfo !== undefined) {
      PoolUserInfo.encode(message.userInfo, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_UpdateUserData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_UpdateUserData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userInfo = PoolUserInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_UpdateUserData {
    return { userInfo: isSet(object.userInfo) ? PoolUserInfo.fromJSON(object.userInfo) : undefined };
  },

  toJSON(message: SSMessage_UpdateUserData): unknown {
    const obj: any = {};
    message.userInfo !== undefined &&
      (obj.userInfo = message.userInfo ? PoolUserInfo.toJSON(message.userInfo) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_UpdateUserData>, I>>(object: I): SSMessage_UpdateUserData {
    const message = createBaseSSMessage_UpdateUserData();
    message.userInfo = (object.userInfo !== undefined && object.userInfo !== null)
      ? PoolUserInfo.fromPartial(object.userInfo)
      : undefined;
    return message;
  },
};

function createBaseSSMessage_RemoveUserData(): SSMessage_RemoveUserData {
  return { userId: "" };
}

export const SSMessage_RemoveUserData = {
  encode(message: SSMessage_RemoveUserData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userId !== "") {
      writer.uint32(10).string(message.userId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SSMessage_RemoveUserData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSSMessage_RemoveUserData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.userId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SSMessage_RemoveUserData {
    return { userId: isSet(object.userId) ? String(object.userId) : "" };
  },

  toJSON(message: SSMessage_RemoveUserData): unknown {
    const obj: any = {};
    message.userId !== undefined && (obj.userId = message.userId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SSMessage_RemoveUserData>, I>>(object: I): SSMessage_RemoveUserData {
    const message = createBaseSSMessage_RemoveUserData();
    message.userId = object.userId ?? "";
    return message;
  },
};

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var tsProtoGlobalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new tsProtoGlobalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
