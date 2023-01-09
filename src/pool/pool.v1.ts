/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";

export const protobufPackage = "pool.v1";

export enum PoolMediaType {
  IMAGE = 0,
  UNRECOGNIZED = -1,
}

export function poolMediaTypeFromJSON(object: any): PoolMediaType {
  switch (object) {
    case 0:
    case "IMAGE":
      return PoolMediaType.IMAGE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PoolMediaType.UNRECOGNIZED;
  }
}

export function poolMediaTypeToJSON(object: PoolMediaType): string {
  switch (object) {
    case PoolMediaType.IMAGE:
      return "IMAGE";
    case PoolMediaType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum PoolNodeState {
  INACTIVE = 0,
  ACTIVE = 1,
  UNRECOGNIZED = -1,
}

export function poolNodeStateFromJSON(object: any): PoolNodeState {
  switch (object) {
    case 0:
    case "INACTIVE":
      return PoolNodeState.INACTIVE;
    case 1:
    case "ACTIVE":
      return PoolNodeState.ACTIVE;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PoolNodeState.UNRECOGNIZED;
  }
}

export function poolNodeStateToJSON(object: PoolNodeState): string {
  switch (object) {
    case PoolNodeState.INACTIVE:
      return "INACTIVE";
    case PoolNodeState.ACTIVE:
      return "ACTIVE";
    case PoolNodeState.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface PoolFileInfo {
  fileId: string;
  fileName: string;
  totalSize: number;
  originNodeId: string;
}

export interface PoolFileOffer {
  fileInfo: PoolFileInfo | undefined;
  seederNodeId: string;
}

export interface PoolFileSeeders {
  fileInfo: PoolFileInfo | undefined;
  seederNodeIds: string[];
}

export interface PoolImageData {
  width: number;
  height: number;
  previewImageBase64: string;
}

export interface PoolChunkRange {
  /** inclusive */
  start: number;
  /** inclusive */
  end: number;
}

export interface PoolMessage {
  msgId: string;
  type: PoolMessage_Type;
  userId: string;
  created: number;
  nodeStateData?: PoolMessage_NodeStateData | undefined;
  latestRequestData?: PoolMessage_LatestRequestData | undefined;
  latestReplyData?: PoolMessage_LatestReplyData | undefined;
  textData?: PoolMessage_TextData | undefined;
  fileOfferData?: PoolFileOffer | undefined;
  mediaOfferData?: PoolMessage_MediaOfferData | undefined;
  fileRequestData?: PoolMessage_FileRequestData | undefined;
  mediaHintRequestData?: PoolMessage_MediaHintRequestData | undefined;
  mediaHintReplyData?: PoolMessage_MediaHintReplyData | undefined;
  retractFileOfferData?: PoolMessage_RetractFileOfferData | undefined;
  retractFileRequestData?: PoolMessage_RetractFileRequestData | undefined;
}

export enum PoolMessage_Type {
  NODE_STATE = 0,
  LATEST_REQUEST = 1,
  LATEST_REPLY = 2,
  TEXT = 3,
  FILE_OFFER = 4,
  MEDIA_OFFER = 5,
  FILE_REQUEST = 6,
  MEDIA_HINT_REQUEST = 7,
  MEDIA_HINT_REPLY = 8,
  RETRACT_FILE_OFFER = 9,
  RETRACT_FILE_REQUEST = 10,
  UNRECOGNIZED = -1,
}

export function poolMessage_TypeFromJSON(object: any): PoolMessage_Type {
  switch (object) {
    case 0:
    case "NODE_STATE":
      return PoolMessage_Type.NODE_STATE;
    case 1:
    case "LATEST_REQUEST":
      return PoolMessage_Type.LATEST_REQUEST;
    case 2:
    case "LATEST_REPLY":
      return PoolMessage_Type.LATEST_REPLY;
    case 3:
    case "TEXT":
      return PoolMessage_Type.TEXT;
    case 4:
    case "FILE_OFFER":
      return PoolMessage_Type.FILE_OFFER;
    case 5:
    case "MEDIA_OFFER":
      return PoolMessage_Type.MEDIA_OFFER;
    case 6:
    case "FILE_REQUEST":
      return PoolMessage_Type.FILE_REQUEST;
    case 7:
    case "MEDIA_HINT_REQUEST":
      return PoolMessage_Type.MEDIA_HINT_REQUEST;
    case 8:
    case "MEDIA_HINT_REPLY":
      return PoolMessage_Type.MEDIA_HINT_REPLY;
    case 9:
    case "RETRACT_FILE_OFFER":
      return PoolMessage_Type.RETRACT_FILE_OFFER;
    case 10:
    case "RETRACT_FILE_REQUEST":
      return PoolMessage_Type.RETRACT_FILE_REQUEST;
    case -1:
    case "UNRECOGNIZED":
    default:
      return PoolMessage_Type.UNRECOGNIZED;
  }
}

export function poolMessage_TypeToJSON(object: PoolMessage_Type): string {
  switch (object) {
    case PoolMessage_Type.NODE_STATE:
      return "NODE_STATE";
    case PoolMessage_Type.LATEST_REQUEST:
      return "LATEST_REQUEST";
    case PoolMessage_Type.LATEST_REPLY:
      return "LATEST_REPLY";
    case PoolMessage_Type.TEXT:
      return "TEXT";
    case PoolMessage_Type.FILE_OFFER:
      return "FILE_OFFER";
    case PoolMessage_Type.MEDIA_OFFER:
      return "MEDIA_OFFER";
    case PoolMessage_Type.FILE_REQUEST:
      return "FILE_REQUEST";
    case PoolMessage_Type.MEDIA_HINT_REQUEST:
      return "MEDIA_HINT_REQUEST";
    case PoolMessage_Type.MEDIA_HINT_REPLY:
      return "MEDIA_HINT_REPLY";
    case PoolMessage_Type.RETRACT_FILE_OFFER:
      return "RETRACT_FILE_OFFER";
    case PoolMessage_Type.RETRACT_FILE_REQUEST:
      return "RETRACT_FILE_REQUEST";
    case PoolMessage_Type.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface PoolMessage_NodeStateData {
  nodeId: string;
  userId: string;
  state: PoolNodeState;
}

export interface PoolMessage_LatestRequestData {
  messagesOnly: boolean;
  lastMessageId: string;
  missedMessages: PoolMessage[];
  initFileOffers: PoolFileOffer[];
}

export interface PoolMessage_LatestReplyData {
  messages: PoolMessage[];
  fileSeeders: PoolFileSeeders[];
  lastMessageIdFound: boolean;
}

export interface PoolMessage_TextData {
  text: string;
}

export interface PoolMessage_MediaOfferData {
  fileOffer: PoolFileOffer | undefined;
  mediaType: PoolMediaType;
  format: string;
  imageData?: PoolImageData | undefined;
}

export interface PoolMessage_FileRequestData {
  fileId: string;
  requestingNodeId: string;
  chunksMissing: PoolChunkRange[];
  promisedChunks: PoolChunkRange[];
}

export interface PoolMessage_MediaHintRequestData {
  fileId: string;
}

export interface PoolMessage_MediaHintReplyData {
  fileId: string;
}

export interface PoolMessage_RetractFileOfferData {
  fileId: string;
  nodeId: string;
}

export interface PoolMessage_RetractFileRequestData {
  fileId: string;
  requestingNodeId: string;
}

export interface PoolMessagePackageSourceInfo {
  nodeId: string;
  path: number[];
}

/** WARNING: pool.hacks relies on this implementation */
export interface PoolMessagePackageDestinationInfo {
  nodeId: string;
  /** To force encode visited = false */
  visited?: boolean | undefined;
}

export interface PoolChunkInfo {
  fileId: string;
  chunkNumber: number;
}

/**
 * problem with optional PoolMessage is decoders
 * can run to problems where 0 is default, thereby
 * making optional useless
 */
export interface PoolMessagePackage {
  src: PoolMessagePackageSourceInfo | undefined;
  dests: PoolMessagePackageDestinationInfo[];
  /** bool has_partner_int_path = 3; */
  partnerIntPath?: number | undefined;
  msg?: PoolMessage | undefined;
  chunkInfo?: PoolChunkInfo | undefined;
}

/** For encoding */
export interface PoolMessagePackageWithChunk {
  src: PoolMessagePackageSourceInfo | undefined;
  dests: PoolMessagePackageDestinationInfo[];
  /** bool has_partner_int_path = 3; */
  partnerIntPath?: number | undefined;
  msg?: PoolMessage | undefined;
  chunkInfo?: PoolChunkInfo | undefined;
  chunk?: Uint8Array | undefined;
}

/** For decoding */
export interface PoolMessagePackageWithOnlyChunk {
  chunk?: Uint8Array | undefined;
}

function createBasePoolFileInfo(): PoolFileInfo {
  return { fileId: "", fileName: "", totalSize: 0, originNodeId: "" };
}

export const PoolFileInfo = {
  encode(message: PoolFileInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.fileName !== "") {
      writer.uint32(18).string(message.fileName);
    }
    if (message.totalSize !== 0) {
      writer.uint32(24).int64(message.totalSize);
    }
    if (message.originNodeId !== "") {
      writer.uint32(34).string(message.originNodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolFileInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolFileInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.fileName = reader.string();
          break;
        case 3:
          message.totalSize = longToNumber(reader.int64() as Long);
          break;
        case 4:
          message.originNodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolFileInfo {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      fileName: isSet(object.fileName) ? String(object.fileName) : "",
      totalSize: isSet(object.totalSize) ? Number(object.totalSize) : 0,
      originNodeId: isSet(object.originNodeId) ? String(object.originNodeId) : "",
    };
  },

  toJSON(message: PoolFileInfo): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.fileName !== undefined && (obj.fileName = message.fileName);
    message.totalSize !== undefined && (obj.totalSize = Math.round(message.totalSize));
    message.originNodeId !== undefined && (obj.originNodeId = message.originNodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolFileInfo>, I>>(object: I): PoolFileInfo {
    const message = createBasePoolFileInfo();
    message.fileId = object.fileId ?? "";
    message.fileName = object.fileName ?? "";
    message.totalSize = object.totalSize ?? 0;
    message.originNodeId = object.originNodeId ?? "";
    return message;
  },
};

function createBasePoolFileOffer(): PoolFileOffer {
  return { fileInfo: undefined, seederNodeId: "" };
}

export const PoolFileOffer = {
  encode(message: PoolFileOffer, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileInfo !== undefined) {
      PoolFileInfo.encode(message.fileInfo, writer.uint32(10).fork()).ldelim();
    }
    if (message.seederNodeId !== "") {
      writer.uint32(18).string(message.seederNodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolFileOffer {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolFileOffer();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileInfo = PoolFileInfo.decode(reader, reader.uint32());
          break;
        case 2:
          message.seederNodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolFileOffer {
    return {
      fileInfo: isSet(object.fileInfo) ? PoolFileInfo.fromJSON(object.fileInfo) : undefined,
      seederNodeId: isSet(object.seederNodeId) ? String(object.seederNodeId) : "",
    };
  },

  toJSON(message: PoolFileOffer): unknown {
    const obj: any = {};
    message.fileInfo !== undefined &&
      (obj.fileInfo = message.fileInfo ? PoolFileInfo.toJSON(message.fileInfo) : undefined);
    message.seederNodeId !== undefined && (obj.seederNodeId = message.seederNodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolFileOffer>, I>>(object: I): PoolFileOffer {
    const message = createBasePoolFileOffer();
    message.fileInfo = (object.fileInfo !== undefined && object.fileInfo !== null)
      ? PoolFileInfo.fromPartial(object.fileInfo)
      : undefined;
    message.seederNodeId = object.seederNodeId ?? "";
    return message;
  },
};

function createBasePoolFileSeeders(): PoolFileSeeders {
  return { fileInfo: undefined, seederNodeIds: [] };
}

export const PoolFileSeeders = {
  encode(message: PoolFileSeeders, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileInfo !== undefined) {
      PoolFileInfo.encode(message.fileInfo, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.seederNodeIds) {
      writer.uint32(18).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolFileSeeders {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolFileSeeders();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileInfo = PoolFileInfo.decode(reader, reader.uint32());
          break;
        case 2:
          message.seederNodeIds.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolFileSeeders {
    return {
      fileInfo: isSet(object.fileInfo) ? PoolFileInfo.fromJSON(object.fileInfo) : undefined,
      seederNodeIds: Array.isArray(object?.seederNodeIds) ? object.seederNodeIds.map((e: any) => String(e)) : [],
    };
  },

  toJSON(message: PoolFileSeeders): unknown {
    const obj: any = {};
    message.fileInfo !== undefined &&
      (obj.fileInfo = message.fileInfo ? PoolFileInfo.toJSON(message.fileInfo) : undefined);
    if (message.seederNodeIds) {
      obj.seederNodeIds = message.seederNodeIds.map((e) => e);
    } else {
      obj.seederNodeIds = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolFileSeeders>, I>>(object: I): PoolFileSeeders {
    const message = createBasePoolFileSeeders();
    message.fileInfo = (object.fileInfo !== undefined && object.fileInfo !== null)
      ? PoolFileInfo.fromPartial(object.fileInfo)
      : undefined;
    message.seederNodeIds = object.seederNodeIds?.map((e) => e) || [];
    return message;
  },
};

function createBasePoolImageData(): PoolImageData {
  return { width: 0, height: 0, previewImageBase64: "" };
}

export const PoolImageData = {
  encode(message: PoolImageData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.width !== 0) {
      writer.uint32(8).int32(message.width);
    }
    if (message.height !== 0) {
      writer.uint32(16).int32(message.height);
    }
    if (message.previewImageBase64 !== "") {
      writer.uint32(26).string(message.previewImageBase64);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolImageData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolImageData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.width = reader.int32();
          break;
        case 2:
          message.height = reader.int32();
          break;
        case 3:
          message.previewImageBase64 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolImageData {
    return {
      width: isSet(object.width) ? Number(object.width) : 0,
      height: isSet(object.height) ? Number(object.height) : 0,
      previewImageBase64: isSet(object.previewImageBase64) ? String(object.previewImageBase64) : "",
    };
  },

  toJSON(message: PoolImageData): unknown {
    const obj: any = {};
    message.width !== undefined && (obj.width = Math.round(message.width));
    message.height !== undefined && (obj.height = Math.round(message.height));
    message.previewImageBase64 !== undefined && (obj.previewImageBase64 = message.previewImageBase64);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolImageData>, I>>(object: I): PoolImageData {
    const message = createBasePoolImageData();
    message.width = object.width ?? 0;
    message.height = object.height ?? 0;
    message.previewImageBase64 = object.previewImageBase64 ?? "";
    return message;
  },
};

function createBasePoolChunkRange(): PoolChunkRange {
  return { start: 0, end: 0 };
}

export const PoolChunkRange = {
  encode(message: PoolChunkRange, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.start !== 0) {
      writer.uint32(8).int64(message.start);
    }
    if (message.end !== 0) {
      writer.uint32(16).int64(message.end);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolChunkRange {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolChunkRange();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.start = longToNumber(reader.int64() as Long);
          break;
        case 2:
          message.end = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolChunkRange {
    return { start: isSet(object.start) ? Number(object.start) : 0, end: isSet(object.end) ? Number(object.end) : 0 };
  },

  toJSON(message: PoolChunkRange): unknown {
    const obj: any = {};
    message.start !== undefined && (obj.start = Math.round(message.start));
    message.end !== undefined && (obj.end = Math.round(message.end));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolChunkRange>, I>>(object: I): PoolChunkRange {
    const message = createBasePoolChunkRange();
    message.start = object.start ?? 0;
    message.end = object.end ?? 0;
    return message;
  },
};

function createBasePoolMessage(): PoolMessage {
  return {
    msgId: "",
    type: 0,
    userId: "",
    created: 0,
    nodeStateData: undefined,
    latestRequestData: undefined,
    latestReplyData: undefined,
    textData: undefined,
    fileOfferData: undefined,
    mediaOfferData: undefined,
    fileRequestData: undefined,
    mediaHintRequestData: undefined,
    mediaHintReplyData: undefined,
    retractFileOfferData: undefined,
    retractFileRequestData: undefined,
  };
}

export const PoolMessage = {
  encode(message: PoolMessage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.msgId !== "") {
      writer.uint32(10).string(message.msgId);
    }
    if (message.type !== 0) {
      writer.uint32(16).int32(message.type);
    }
    if (message.userId !== "") {
      writer.uint32(26).string(message.userId);
    }
    if (message.created !== 0) {
      writer.uint32(32).int64(message.created);
    }
    if (message.nodeStateData !== undefined) {
      PoolMessage_NodeStateData.encode(message.nodeStateData, writer.uint32(42).fork()).ldelim();
    }
    if (message.latestRequestData !== undefined) {
      PoolMessage_LatestRequestData.encode(message.latestRequestData, writer.uint32(50).fork()).ldelim();
    }
    if (message.latestReplyData !== undefined) {
      PoolMessage_LatestReplyData.encode(message.latestReplyData, writer.uint32(58).fork()).ldelim();
    }
    if (message.textData !== undefined) {
      PoolMessage_TextData.encode(message.textData, writer.uint32(66).fork()).ldelim();
    }
    if (message.fileOfferData !== undefined) {
      PoolFileOffer.encode(message.fileOfferData, writer.uint32(74).fork()).ldelim();
    }
    if (message.mediaOfferData !== undefined) {
      PoolMessage_MediaOfferData.encode(message.mediaOfferData, writer.uint32(82).fork()).ldelim();
    }
    if (message.fileRequestData !== undefined) {
      PoolMessage_FileRequestData.encode(message.fileRequestData, writer.uint32(90).fork()).ldelim();
    }
    if (message.mediaHintRequestData !== undefined) {
      PoolMessage_MediaHintRequestData.encode(message.mediaHintRequestData, writer.uint32(98).fork()).ldelim();
    }
    if (message.mediaHintReplyData !== undefined) {
      PoolMessage_MediaHintReplyData.encode(message.mediaHintReplyData, writer.uint32(106).fork()).ldelim();
    }
    if (message.retractFileOfferData !== undefined) {
      PoolMessage_RetractFileOfferData.encode(message.retractFileOfferData, writer.uint32(114).fork()).ldelim();
    }
    if (message.retractFileRequestData !== undefined) {
      PoolMessage_RetractFileRequestData.encode(message.retractFileRequestData, writer.uint32(122).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.msgId = reader.string();
          break;
        case 2:
          message.type = reader.int32() as any;
          break;
        case 3:
          message.userId = reader.string();
          break;
        case 4:
          message.created = longToNumber(reader.int64() as Long);
          break;
        case 5:
          message.nodeStateData = PoolMessage_NodeStateData.decode(reader, reader.uint32());
          break;
        case 6:
          message.latestRequestData = PoolMessage_LatestRequestData.decode(reader, reader.uint32());
          break;
        case 7:
          message.latestReplyData = PoolMessage_LatestReplyData.decode(reader, reader.uint32());
          break;
        case 8:
          message.textData = PoolMessage_TextData.decode(reader, reader.uint32());
          break;
        case 9:
          message.fileOfferData = PoolFileOffer.decode(reader, reader.uint32());
          break;
        case 10:
          message.mediaOfferData = PoolMessage_MediaOfferData.decode(reader, reader.uint32());
          break;
        case 11:
          message.fileRequestData = PoolMessage_FileRequestData.decode(reader, reader.uint32());
          break;
        case 12:
          message.mediaHintRequestData = PoolMessage_MediaHintRequestData.decode(reader, reader.uint32());
          break;
        case 13:
          message.mediaHintReplyData = PoolMessage_MediaHintReplyData.decode(reader, reader.uint32());
          break;
        case 14:
          message.retractFileOfferData = PoolMessage_RetractFileOfferData.decode(reader, reader.uint32());
          break;
        case 15:
          message.retractFileRequestData = PoolMessage_RetractFileRequestData.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage {
    return {
      msgId: isSet(object.msgId) ? String(object.msgId) : "",
      type: isSet(object.type) ? poolMessage_TypeFromJSON(object.type) : 0,
      userId: isSet(object.userId) ? String(object.userId) : "",
      created: isSet(object.created) ? Number(object.created) : 0,
      nodeStateData: isSet(object.nodeStateData) ? PoolMessage_NodeStateData.fromJSON(object.nodeStateData) : undefined,
      latestRequestData: isSet(object.latestRequestData)
        ? PoolMessage_LatestRequestData.fromJSON(object.latestRequestData)
        : undefined,
      latestReplyData: isSet(object.latestReplyData)
        ? PoolMessage_LatestReplyData.fromJSON(object.latestReplyData)
        : undefined,
      textData: isSet(object.textData) ? PoolMessage_TextData.fromJSON(object.textData) : undefined,
      fileOfferData: isSet(object.fileOfferData) ? PoolFileOffer.fromJSON(object.fileOfferData) : undefined,
      mediaOfferData: isSet(object.mediaOfferData)
        ? PoolMessage_MediaOfferData.fromJSON(object.mediaOfferData)
        : undefined,
      fileRequestData: isSet(object.fileRequestData)
        ? PoolMessage_FileRequestData.fromJSON(object.fileRequestData)
        : undefined,
      mediaHintRequestData: isSet(object.mediaHintRequestData)
        ? PoolMessage_MediaHintRequestData.fromJSON(object.mediaHintRequestData)
        : undefined,
      mediaHintReplyData: isSet(object.mediaHintReplyData)
        ? PoolMessage_MediaHintReplyData.fromJSON(object.mediaHintReplyData)
        : undefined,
      retractFileOfferData: isSet(object.retractFileOfferData)
        ? PoolMessage_RetractFileOfferData.fromJSON(object.retractFileOfferData)
        : undefined,
      retractFileRequestData: isSet(object.retractFileRequestData)
        ? PoolMessage_RetractFileRequestData.fromJSON(object.retractFileRequestData)
        : undefined,
    };
  },

  toJSON(message: PoolMessage): unknown {
    const obj: any = {};
    message.msgId !== undefined && (obj.msgId = message.msgId);
    message.type !== undefined && (obj.type = poolMessage_TypeToJSON(message.type));
    message.userId !== undefined && (obj.userId = message.userId);
    message.created !== undefined && (obj.created = Math.round(message.created));
    message.nodeStateData !== undefined &&
      (obj.nodeStateData = message.nodeStateData ? PoolMessage_NodeStateData.toJSON(message.nodeStateData) : undefined);
    message.latestRequestData !== undefined && (obj.latestRequestData = message.latestRequestData
      ? PoolMessage_LatestRequestData.toJSON(message.latestRequestData)
      : undefined);
    message.latestReplyData !== undefined && (obj.latestReplyData = message.latestReplyData
      ? PoolMessage_LatestReplyData.toJSON(message.latestReplyData)
      : undefined);
    message.textData !== undefined &&
      (obj.textData = message.textData ? PoolMessage_TextData.toJSON(message.textData) : undefined);
    message.fileOfferData !== undefined &&
      (obj.fileOfferData = message.fileOfferData ? PoolFileOffer.toJSON(message.fileOfferData) : undefined);
    message.mediaOfferData !== undefined && (obj.mediaOfferData = message.mediaOfferData
      ? PoolMessage_MediaOfferData.toJSON(message.mediaOfferData)
      : undefined);
    message.fileRequestData !== undefined && (obj.fileRequestData = message.fileRequestData
      ? PoolMessage_FileRequestData.toJSON(message.fileRequestData)
      : undefined);
    message.mediaHintRequestData !== undefined && (obj.mediaHintRequestData = message.mediaHintRequestData
      ? PoolMessage_MediaHintRequestData.toJSON(message.mediaHintRequestData)
      : undefined);
    message.mediaHintReplyData !== undefined && (obj.mediaHintReplyData = message.mediaHintReplyData
      ? PoolMessage_MediaHintReplyData.toJSON(message.mediaHintReplyData)
      : undefined);
    message.retractFileOfferData !== undefined && (obj.retractFileOfferData = message.retractFileOfferData
      ? PoolMessage_RetractFileOfferData.toJSON(message.retractFileOfferData)
      : undefined);
    message.retractFileRequestData !== undefined && (obj.retractFileRequestData = message.retractFileRequestData
      ? PoolMessage_RetractFileRequestData.toJSON(message.retractFileRequestData)
      : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage>, I>>(object: I): PoolMessage {
    const message = createBasePoolMessage();
    message.msgId = object.msgId ?? "";
    message.type = object.type ?? 0;
    message.userId = object.userId ?? "";
    message.created = object.created ?? 0;
    message.nodeStateData = (object.nodeStateData !== undefined && object.nodeStateData !== null)
      ? PoolMessage_NodeStateData.fromPartial(object.nodeStateData)
      : undefined;
    message.latestRequestData = (object.latestRequestData !== undefined && object.latestRequestData !== null)
      ? PoolMessage_LatestRequestData.fromPartial(object.latestRequestData)
      : undefined;
    message.latestReplyData = (object.latestReplyData !== undefined && object.latestReplyData !== null)
      ? PoolMessage_LatestReplyData.fromPartial(object.latestReplyData)
      : undefined;
    message.textData = (object.textData !== undefined && object.textData !== null)
      ? PoolMessage_TextData.fromPartial(object.textData)
      : undefined;
    message.fileOfferData = (object.fileOfferData !== undefined && object.fileOfferData !== null)
      ? PoolFileOffer.fromPartial(object.fileOfferData)
      : undefined;
    message.mediaOfferData = (object.mediaOfferData !== undefined && object.mediaOfferData !== null)
      ? PoolMessage_MediaOfferData.fromPartial(object.mediaOfferData)
      : undefined;
    message.fileRequestData = (object.fileRequestData !== undefined && object.fileRequestData !== null)
      ? PoolMessage_FileRequestData.fromPartial(object.fileRequestData)
      : undefined;
    message.mediaHintRequestData = (object.mediaHintRequestData !== undefined && object.mediaHintRequestData !== null)
      ? PoolMessage_MediaHintRequestData.fromPartial(object.mediaHintRequestData)
      : undefined;
    message.mediaHintReplyData = (object.mediaHintReplyData !== undefined && object.mediaHintReplyData !== null)
      ? PoolMessage_MediaHintReplyData.fromPartial(object.mediaHintReplyData)
      : undefined;
    message.retractFileOfferData = (object.retractFileOfferData !== undefined && object.retractFileOfferData !== null)
      ? PoolMessage_RetractFileOfferData.fromPartial(object.retractFileOfferData)
      : undefined;
    message.retractFileRequestData =
      (object.retractFileRequestData !== undefined && object.retractFileRequestData !== null)
        ? PoolMessage_RetractFileRequestData.fromPartial(object.retractFileRequestData)
        : undefined;
    return message;
  },
};

function createBasePoolMessage_NodeStateData(): PoolMessage_NodeStateData {
  return { nodeId: "", userId: "", state: 0 };
}

export const PoolMessage_NodeStateData = {
  encode(message: PoolMessage_NodeStateData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    if (message.userId !== "") {
      writer.uint32(18).string(message.userId);
    }
    if (message.state !== 0) {
      writer.uint32(24).int32(message.state);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_NodeStateData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_NodeStateData();
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
          message.state = reader.int32() as any;
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_NodeStateData {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      userId: isSet(object.userId) ? String(object.userId) : "",
      state: isSet(object.state) ? poolNodeStateFromJSON(object.state) : 0,
    };
  },

  toJSON(message: PoolMessage_NodeStateData): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    message.userId !== undefined && (obj.userId = message.userId);
    message.state !== undefined && (obj.state = poolNodeStateToJSON(message.state));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_NodeStateData>, I>>(object: I): PoolMessage_NodeStateData {
    const message = createBasePoolMessage_NodeStateData();
    message.nodeId = object.nodeId ?? "";
    message.userId = object.userId ?? "";
    message.state = object.state ?? 0;
    return message;
  },
};

function createBasePoolMessage_LatestRequestData(): PoolMessage_LatestRequestData {
  return { messagesOnly: false, lastMessageId: "", missedMessages: [], initFileOffers: [] };
}

export const PoolMessage_LatestRequestData = {
  encode(message: PoolMessage_LatestRequestData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.messagesOnly === true) {
      writer.uint32(8).bool(message.messagesOnly);
    }
    if (message.lastMessageId !== "") {
      writer.uint32(18).string(message.lastMessageId);
    }
    for (const v of message.missedMessages) {
      PoolMessage.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.initFileOffers) {
      PoolFileOffer.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_LatestRequestData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_LatestRequestData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.messagesOnly = reader.bool();
          break;
        case 2:
          message.lastMessageId = reader.string();
          break;
        case 3:
          message.missedMessages.push(PoolMessage.decode(reader, reader.uint32()));
          break;
        case 4:
          message.initFileOffers.push(PoolFileOffer.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_LatestRequestData {
    return {
      messagesOnly: isSet(object.messagesOnly) ? Boolean(object.messagesOnly) : false,
      lastMessageId: isSet(object.lastMessageId) ? String(object.lastMessageId) : "",
      missedMessages: Array.isArray(object?.missedMessages)
        ? object.missedMessages.map((e: any) => PoolMessage.fromJSON(e))
        : [],
      initFileOffers: Array.isArray(object?.initFileOffers)
        ? object.initFileOffers.map((e: any) => PoolFileOffer.fromJSON(e))
        : [],
    };
  },

  toJSON(message: PoolMessage_LatestRequestData): unknown {
    const obj: any = {};
    message.messagesOnly !== undefined && (obj.messagesOnly = message.messagesOnly);
    message.lastMessageId !== undefined && (obj.lastMessageId = message.lastMessageId);
    if (message.missedMessages) {
      obj.missedMessages = message.missedMessages.map((e) => e ? PoolMessage.toJSON(e) : undefined);
    } else {
      obj.missedMessages = [];
    }
    if (message.initFileOffers) {
      obj.initFileOffers = message.initFileOffers.map((e) => e ? PoolFileOffer.toJSON(e) : undefined);
    } else {
      obj.initFileOffers = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_LatestRequestData>, I>>(
    object: I,
  ): PoolMessage_LatestRequestData {
    const message = createBasePoolMessage_LatestRequestData();
    message.messagesOnly = object.messagesOnly ?? false;
    message.lastMessageId = object.lastMessageId ?? "";
    message.missedMessages = object.missedMessages?.map((e) => PoolMessage.fromPartial(e)) || [];
    message.initFileOffers = object.initFileOffers?.map((e) => PoolFileOffer.fromPartial(e)) || [];
    return message;
  },
};

function createBasePoolMessage_LatestReplyData(): PoolMessage_LatestReplyData {
  return { messages: [], fileSeeders: [], lastMessageIdFound: false };
}

export const PoolMessage_LatestReplyData = {
  encode(message: PoolMessage_LatestReplyData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.messages) {
      PoolMessage.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.fileSeeders) {
      PoolFileSeeders.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.lastMessageIdFound === true) {
      writer.uint32(24).bool(message.lastMessageIdFound);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_LatestReplyData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_LatestReplyData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.messages.push(PoolMessage.decode(reader, reader.uint32()));
          break;
        case 2:
          message.fileSeeders.push(PoolFileSeeders.decode(reader, reader.uint32()));
          break;
        case 3:
          message.lastMessageIdFound = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_LatestReplyData {
    return {
      messages: Array.isArray(object?.messages) ? object.messages.map((e: any) => PoolMessage.fromJSON(e)) : [],
      fileSeeders: Array.isArray(object?.fileSeeders)
        ? object.fileSeeders.map((e: any) => PoolFileSeeders.fromJSON(e))
        : [],
      lastMessageIdFound: isSet(object.lastMessageIdFound) ? Boolean(object.lastMessageIdFound) : false,
    };
  },

  toJSON(message: PoolMessage_LatestReplyData): unknown {
    const obj: any = {};
    if (message.messages) {
      obj.messages = message.messages.map((e) => e ? PoolMessage.toJSON(e) : undefined);
    } else {
      obj.messages = [];
    }
    if (message.fileSeeders) {
      obj.fileSeeders = message.fileSeeders.map((e) => e ? PoolFileSeeders.toJSON(e) : undefined);
    } else {
      obj.fileSeeders = [];
    }
    message.lastMessageIdFound !== undefined && (obj.lastMessageIdFound = message.lastMessageIdFound);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_LatestReplyData>, I>>(object: I): PoolMessage_LatestReplyData {
    const message = createBasePoolMessage_LatestReplyData();
    message.messages = object.messages?.map((e) => PoolMessage.fromPartial(e)) || [];
    message.fileSeeders = object.fileSeeders?.map((e) => PoolFileSeeders.fromPartial(e)) || [];
    message.lastMessageIdFound = object.lastMessageIdFound ?? false;
    return message;
  },
};

function createBasePoolMessage_TextData(): PoolMessage_TextData {
  return { text: "" };
}

export const PoolMessage_TextData = {
  encode(message: PoolMessage_TextData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.text !== "") {
      writer.uint32(10).string(message.text);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_TextData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_TextData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.text = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_TextData {
    return { text: isSet(object.text) ? String(object.text) : "" };
  },

  toJSON(message: PoolMessage_TextData): unknown {
    const obj: any = {};
    message.text !== undefined && (obj.text = message.text);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_TextData>, I>>(object: I): PoolMessage_TextData {
    const message = createBasePoolMessage_TextData();
    message.text = object.text ?? "";
    return message;
  },
};

function createBasePoolMessage_MediaOfferData(): PoolMessage_MediaOfferData {
  return { fileOffer: undefined, mediaType: 0, format: "", imageData: undefined };
}

export const PoolMessage_MediaOfferData = {
  encode(message: PoolMessage_MediaOfferData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileOffer !== undefined) {
      PoolFileOffer.encode(message.fileOffer, writer.uint32(10).fork()).ldelim();
    }
    if (message.mediaType !== 0) {
      writer.uint32(16).int32(message.mediaType);
    }
    if (message.format !== "") {
      writer.uint32(26).string(message.format);
    }
    if (message.imageData !== undefined) {
      PoolImageData.encode(message.imageData, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_MediaOfferData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_MediaOfferData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileOffer = PoolFileOffer.decode(reader, reader.uint32());
          break;
        case 2:
          message.mediaType = reader.int32() as any;
          break;
        case 3:
          message.format = reader.string();
          break;
        case 4:
          message.imageData = PoolImageData.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_MediaOfferData {
    return {
      fileOffer: isSet(object.fileOffer) ? PoolFileOffer.fromJSON(object.fileOffer) : undefined,
      mediaType: isSet(object.mediaType) ? poolMediaTypeFromJSON(object.mediaType) : 0,
      format: isSet(object.format) ? String(object.format) : "",
      imageData: isSet(object.imageData) ? PoolImageData.fromJSON(object.imageData) : undefined,
    };
  },

  toJSON(message: PoolMessage_MediaOfferData): unknown {
    const obj: any = {};
    message.fileOffer !== undefined &&
      (obj.fileOffer = message.fileOffer ? PoolFileOffer.toJSON(message.fileOffer) : undefined);
    message.mediaType !== undefined && (obj.mediaType = poolMediaTypeToJSON(message.mediaType));
    message.format !== undefined && (obj.format = message.format);
    message.imageData !== undefined &&
      (obj.imageData = message.imageData ? PoolImageData.toJSON(message.imageData) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_MediaOfferData>, I>>(object: I): PoolMessage_MediaOfferData {
    const message = createBasePoolMessage_MediaOfferData();
    message.fileOffer = (object.fileOffer !== undefined && object.fileOffer !== null)
      ? PoolFileOffer.fromPartial(object.fileOffer)
      : undefined;
    message.mediaType = object.mediaType ?? 0;
    message.format = object.format ?? "";
    message.imageData = (object.imageData !== undefined && object.imageData !== null)
      ? PoolImageData.fromPartial(object.imageData)
      : undefined;
    return message;
  },
};

function createBasePoolMessage_FileRequestData(): PoolMessage_FileRequestData {
  return { fileId: "", requestingNodeId: "", chunksMissing: [], promisedChunks: [] };
}

export const PoolMessage_FileRequestData = {
  encode(message: PoolMessage_FileRequestData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.requestingNodeId !== "") {
      writer.uint32(18).string(message.requestingNodeId);
    }
    for (const v of message.chunksMissing) {
      PoolChunkRange.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.promisedChunks) {
      PoolChunkRange.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_FileRequestData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_FileRequestData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.requestingNodeId = reader.string();
          break;
        case 3:
          message.chunksMissing.push(PoolChunkRange.decode(reader, reader.uint32()));
          break;
        case 4:
          message.promisedChunks.push(PoolChunkRange.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_FileRequestData {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      requestingNodeId: isSet(object.requestingNodeId) ? String(object.requestingNodeId) : "",
      chunksMissing: Array.isArray(object?.chunksMissing)
        ? object.chunksMissing.map((e: any) => PoolChunkRange.fromJSON(e))
        : [],
      promisedChunks: Array.isArray(object?.promisedChunks)
        ? object.promisedChunks.map((e: any) => PoolChunkRange.fromJSON(e))
        : [],
    };
  },

  toJSON(message: PoolMessage_FileRequestData): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.requestingNodeId !== undefined && (obj.requestingNodeId = message.requestingNodeId);
    if (message.chunksMissing) {
      obj.chunksMissing = message.chunksMissing.map((e) => e ? PoolChunkRange.toJSON(e) : undefined);
    } else {
      obj.chunksMissing = [];
    }
    if (message.promisedChunks) {
      obj.promisedChunks = message.promisedChunks.map((e) => e ? PoolChunkRange.toJSON(e) : undefined);
    } else {
      obj.promisedChunks = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_FileRequestData>, I>>(object: I): PoolMessage_FileRequestData {
    const message = createBasePoolMessage_FileRequestData();
    message.fileId = object.fileId ?? "";
    message.requestingNodeId = object.requestingNodeId ?? "";
    message.chunksMissing = object.chunksMissing?.map((e) => PoolChunkRange.fromPartial(e)) || [];
    message.promisedChunks = object.promisedChunks?.map((e) => PoolChunkRange.fromPartial(e)) || [];
    return message;
  },
};

function createBasePoolMessage_MediaHintRequestData(): PoolMessage_MediaHintRequestData {
  return { fileId: "" };
}

export const PoolMessage_MediaHintRequestData = {
  encode(message: PoolMessage_MediaHintRequestData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_MediaHintRequestData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_MediaHintRequestData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_MediaHintRequestData {
    return { fileId: isSet(object.fileId) ? String(object.fileId) : "" };
  },

  toJSON(message: PoolMessage_MediaHintRequestData): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_MediaHintRequestData>, I>>(
    object: I,
  ): PoolMessage_MediaHintRequestData {
    const message = createBasePoolMessage_MediaHintRequestData();
    message.fileId = object.fileId ?? "";
    return message;
  },
};

function createBasePoolMessage_MediaHintReplyData(): PoolMessage_MediaHintReplyData {
  return { fileId: "" };
}

export const PoolMessage_MediaHintReplyData = {
  encode(message: PoolMessage_MediaHintReplyData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_MediaHintReplyData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_MediaHintReplyData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_MediaHintReplyData {
    return { fileId: isSet(object.fileId) ? String(object.fileId) : "" };
  },

  toJSON(message: PoolMessage_MediaHintReplyData): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_MediaHintReplyData>, I>>(
    object: I,
  ): PoolMessage_MediaHintReplyData {
    const message = createBasePoolMessage_MediaHintReplyData();
    message.fileId = object.fileId ?? "";
    return message;
  },
};

function createBasePoolMessage_RetractFileOfferData(): PoolMessage_RetractFileOfferData {
  return { fileId: "", nodeId: "" };
}

export const PoolMessage_RetractFileOfferData = {
  encode(message: PoolMessage_RetractFileOfferData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.nodeId !== "") {
      writer.uint32(18).string(message.nodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_RetractFileOfferData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_RetractFileOfferData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.nodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_RetractFileOfferData {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
    };
  },

  toJSON(message: PoolMessage_RetractFileOfferData): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_RetractFileOfferData>, I>>(
    object: I,
  ): PoolMessage_RetractFileOfferData {
    const message = createBasePoolMessage_RetractFileOfferData();
    message.fileId = object.fileId ?? "";
    message.nodeId = object.nodeId ?? "";
    return message;
  },
};

function createBasePoolMessage_RetractFileRequestData(): PoolMessage_RetractFileRequestData {
  return { fileId: "", requestingNodeId: "" };
}

export const PoolMessage_RetractFileRequestData = {
  encode(message: PoolMessage_RetractFileRequestData, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.requestingNodeId !== "") {
      writer.uint32(18).string(message.requestingNodeId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessage_RetractFileRequestData {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessage_RetractFileRequestData();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.requestingNodeId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessage_RetractFileRequestData {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      requestingNodeId: isSet(object.requestingNodeId) ? String(object.requestingNodeId) : "",
    };
  },

  toJSON(message: PoolMessage_RetractFileRequestData): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.requestingNodeId !== undefined && (obj.requestingNodeId = message.requestingNodeId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessage_RetractFileRequestData>, I>>(
    object: I,
  ): PoolMessage_RetractFileRequestData {
    const message = createBasePoolMessage_RetractFileRequestData();
    message.fileId = object.fileId ?? "";
    message.requestingNodeId = object.requestingNodeId ?? "";
    return message;
  },
};

function createBasePoolMessagePackageSourceInfo(): PoolMessagePackageSourceInfo {
  return { nodeId: "", path: [] };
}

export const PoolMessagePackageSourceInfo = {
  encode(message: PoolMessagePackageSourceInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    writer.uint32(18).fork();
    for (const v of message.path) {
      writer.int32(v);
    }
    writer.ldelim();
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessagePackageSourceInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessagePackageSourceInfo();
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
              message.path.push(reader.int32());
            }
          } else {
            message.path.push(reader.int32());
          }
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessagePackageSourceInfo {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      path: Array.isArray(object?.path) ? object.path.map((e: any) => Number(e)) : [],
    };
  },

  toJSON(message: PoolMessagePackageSourceInfo): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    if (message.path) {
      obj.path = message.path.map((e) => Math.round(e));
    } else {
      obj.path = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessagePackageSourceInfo>, I>>(object: I): PoolMessagePackageSourceInfo {
    const message = createBasePoolMessagePackageSourceInfo();
    message.nodeId = object.nodeId ?? "";
    message.path = object.path?.map((e) => e) || [];
    return message;
  },
};

function createBasePoolMessagePackageDestinationInfo(): PoolMessagePackageDestinationInfo {
  return { nodeId: "", visited: undefined };
}

export const PoolMessagePackageDestinationInfo = {
  encode(message: PoolMessagePackageDestinationInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.nodeId !== "") {
      writer.uint32(10).string(message.nodeId);
    }
    if (message.visited !== undefined) {
      writer.uint32(16).bool(message.visited);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessagePackageDestinationInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessagePackageDestinationInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.nodeId = reader.string();
          break;
        case 2:
          message.visited = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessagePackageDestinationInfo {
    return {
      nodeId: isSet(object.nodeId) ? String(object.nodeId) : "",
      visited: isSet(object.visited) ? Boolean(object.visited) : undefined,
    };
  },

  toJSON(message: PoolMessagePackageDestinationInfo): unknown {
    const obj: any = {};
    message.nodeId !== undefined && (obj.nodeId = message.nodeId);
    message.visited !== undefined && (obj.visited = message.visited);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessagePackageDestinationInfo>, I>>(
    object: I,
  ): PoolMessagePackageDestinationInfo {
    const message = createBasePoolMessagePackageDestinationInfo();
    message.nodeId = object.nodeId ?? "";
    message.visited = object.visited ?? undefined;
    return message;
  },
};

function createBasePoolChunkInfo(): PoolChunkInfo {
  return { fileId: "", chunkNumber: 0 };
}

export const PoolChunkInfo = {
  encode(message: PoolChunkInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.fileId !== "") {
      writer.uint32(10).string(message.fileId);
    }
    if (message.chunkNumber !== 0) {
      writer.uint32(16).int64(message.chunkNumber);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolChunkInfo {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolChunkInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.fileId = reader.string();
          break;
        case 2:
          message.chunkNumber = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolChunkInfo {
    return {
      fileId: isSet(object.fileId) ? String(object.fileId) : "",
      chunkNumber: isSet(object.chunkNumber) ? Number(object.chunkNumber) : 0,
    };
  },

  toJSON(message: PoolChunkInfo): unknown {
    const obj: any = {};
    message.fileId !== undefined && (obj.fileId = message.fileId);
    message.chunkNumber !== undefined && (obj.chunkNumber = Math.round(message.chunkNumber));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolChunkInfo>, I>>(object: I): PoolChunkInfo {
    const message = createBasePoolChunkInfo();
    message.fileId = object.fileId ?? "";
    message.chunkNumber = object.chunkNumber ?? 0;
    return message;
  },
};

function createBasePoolMessagePackage(): PoolMessagePackage {
  return { src: undefined, dests: [], partnerIntPath: undefined, msg: undefined, chunkInfo: undefined };
}

export const PoolMessagePackage = {
  encode(message: PoolMessagePackage, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.src !== undefined) {
      PoolMessagePackageSourceInfo.encode(message.src, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.dests) {
      PoolMessagePackageDestinationInfo.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.partnerIntPath !== undefined) {
      writer.uint32(32).int32(message.partnerIntPath);
    }
    if (message.msg !== undefined) {
      PoolMessage.encode(message.msg, writer.uint32(42).fork()).ldelim();
    }
    if (message.chunkInfo !== undefined) {
      PoolChunkInfo.encode(message.chunkInfo, writer.uint32(50).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessagePackage {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessagePackage();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.src = PoolMessagePackageSourceInfo.decode(reader, reader.uint32());
          break;
        case 2:
          message.dests.push(PoolMessagePackageDestinationInfo.decode(reader, reader.uint32()));
          break;
        case 4:
          message.partnerIntPath = reader.int32();
          break;
        case 5:
          message.msg = PoolMessage.decode(reader, reader.uint32());
          break;
        case 6:
          message.chunkInfo = PoolChunkInfo.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessagePackage {
    return {
      src: isSet(object.src) ? PoolMessagePackageSourceInfo.fromJSON(object.src) : undefined,
      dests: Array.isArray(object?.dests)
        ? object.dests.map((e: any) => PoolMessagePackageDestinationInfo.fromJSON(e))
        : [],
      partnerIntPath: isSet(object.partnerIntPath) ? Number(object.partnerIntPath) : undefined,
      msg: isSet(object.msg) ? PoolMessage.fromJSON(object.msg) : undefined,
      chunkInfo: isSet(object.chunkInfo) ? PoolChunkInfo.fromJSON(object.chunkInfo) : undefined,
    };
  },

  toJSON(message: PoolMessagePackage): unknown {
    const obj: any = {};
    message.src !== undefined && (obj.src = message.src ? PoolMessagePackageSourceInfo.toJSON(message.src) : undefined);
    if (message.dests) {
      obj.dests = message.dests.map((e) => e ? PoolMessagePackageDestinationInfo.toJSON(e) : undefined);
    } else {
      obj.dests = [];
    }
    message.partnerIntPath !== undefined && (obj.partnerIntPath = Math.round(message.partnerIntPath));
    message.msg !== undefined && (obj.msg = message.msg ? PoolMessage.toJSON(message.msg) : undefined);
    message.chunkInfo !== undefined &&
      (obj.chunkInfo = message.chunkInfo ? PoolChunkInfo.toJSON(message.chunkInfo) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessagePackage>, I>>(object: I): PoolMessagePackage {
    const message = createBasePoolMessagePackage();
    message.src = (object.src !== undefined && object.src !== null)
      ? PoolMessagePackageSourceInfo.fromPartial(object.src)
      : undefined;
    message.dests = object.dests?.map((e) => PoolMessagePackageDestinationInfo.fromPartial(e)) || [];
    message.partnerIntPath = object.partnerIntPath ?? undefined;
    message.msg = (object.msg !== undefined && object.msg !== null) ? PoolMessage.fromPartial(object.msg) : undefined;
    message.chunkInfo = (object.chunkInfo !== undefined && object.chunkInfo !== null)
      ? PoolChunkInfo.fromPartial(object.chunkInfo)
      : undefined;
    return message;
  },
};

function createBasePoolMessagePackageWithChunk(): PoolMessagePackageWithChunk {
  return {
    src: undefined,
    dests: [],
    partnerIntPath: undefined,
    msg: undefined,
    chunkInfo: undefined,
    chunk: undefined,
  };
}

export const PoolMessagePackageWithChunk = {
  encode(message: PoolMessagePackageWithChunk, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.src !== undefined) {
      PoolMessagePackageSourceInfo.encode(message.src, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.dests) {
      PoolMessagePackageDestinationInfo.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    if (message.partnerIntPath !== undefined) {
      writer.uint32(32).int32(message.partnerIntPath);
    }
    if (message.msg !== undefined) {
      PoolMessage.encode(message.msg, writer.uint32(42).fork()).ldelim();
    }
    if (message.chunkInfo !== undefined) {
      PoolChunkInfo.encode(message.chunkInfo, writer.uint32(50).fork()).ldelim();
    }
    if (message.chunk !== undefined) {
      writer.uint32(58).bytes(message.chunk);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessagePackageWithChunk {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessagePackageWithChunk();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.src = PoolMessagePackageSourceInfo.decode(reader, reader.uint32());
          break;
        case 2:
          message.dests.push(PoolMessagePackageDestinationInfo.decode(reader, reader.uint32()));
          break;
        case 4:
          message.partnerIntPath = reader.int32();
          break;
        case 5:
          message.msg = PoolMessage.decode(reader, reader.uint32());
          break;
        case 6:
          message.chunkInfo = PoolChunkInfo.decode(reader, reader.uint32());
          break;
        case 7:
          message.chunk = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessagePackageWithChunk {
    return {
      src: isSet(object.src) ? PoolMessagePackageSourceInfo.fromJSON(object.src) : undefined,
      dests: Array.isArray(object?.dests)
        ? object.dests.map((e: any) => PoolMessagePackageDestinationInfo.fromJSON(e))
        : [],
      partnerIntPath: isSet(object.partnerIntPath) ? Number(object.partnerIntPath) : undefined,
      msg: isSet(object.msg) ? PoolMessage.fromJSON(object.msg) : undefined,
      chunkInfo: isSet(object.chunkInfo) ? PoolChunkInfo.fromJSON(object.chunkInfo) : undefined,
      chunk: isSet(object.chunk) ? bytesFromBase64(object.chunk) : undefined,
    };
  },

  toJSON(message: PoolMessagePackageWithChunk): unknown {
    const obj: any = {};
    message.src !== undefined && (obj.src = message.src ? PoolMessagePackageSourceInfo.toJSON(message.src) : undefined);
    if (message.dests) {
      obj.dests = message.dests.map((e) => e ? PoolMessagePackageDestinationInfo.toJSON(e) : undefined);
    } else {
      obj.dests = [];
    }
    message.partnerIntPath !== undefined && (obj.partnerIntPath = Math.round(message.partnerIntPath));
    message.msg !== undefined && (obj.msg = message.msg ? PoolMessage.toJSON(message.msg) : undefined);
    message.chunkInfo !== undefined &&
      (obj.chunkInfo = message.chunkInfo ? PoolChunkInfo.toJSON(message.chunkInfo) : undefined);
    message.chunk !== undefined &&
      (obj.chunk = message.chunk !== undefined ? base64FromBytes(message.chunk) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessagePackageWithChunk>, I>>(object: I): PoolMessagePackageWithChunk {
    const message = createBasePoolMessagePackageWithChunk();
    message.src = (object.src !== undefined && object.src !== null)
      ? PoolMessagePackageSourceInfo.fromPartial(object.src)
      : undefined;
    message.dests = object.dests?.map((e) => PoolMessagePackageDestinationInfo.fromPartial(e)) || [];
    message.partnerIntPath = object.partnerIntPath ?? undefined;
    message.msg = (object.msg !== undefined && object.msg !== null) ? PoolMessage.fromPartial(object.msg) : undefined;
    message.chunkInfo = (object.chunkInfo !== undefined && object.chunkInfo !== null)
      ? PoolChunkInfo.fromPartial(object.chunkInfo)
      : undefined;
    message.chunk = object.chunk ?? undefined;
    return message;
  },
};

function createBasePoolMessagePackageWithOnlyChunk(): PoolMessagePackageWithOnlyChunk {
  return { chunk: undefined };
}

export const PoolMessagePackageWithOnlyChunk = {
  encode(message: PoolMessagePackageWithOnlyChunk, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.chunk !== undefined) {
      writer.uint32(58).bytes(message.chunk);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): PoolMessagePackageWithOnlyChunk {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBasePoolMessagePackageWithOnlyChunk();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 7:
          message.chunk = reader.bytes();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): PoolMessagePackageWithOnlyChunk {
    return { chunk: isSet(object.chunk) ? bytesFromBase64(object.chunk) : undefined };
  },

  toJSON(message: PoolMessagePackageWithOnlyChunk): unknown {
    const obj: any = {};
    message.chunk !== undefined &&
      (obj.chunk = message.chunk !== undefined ? base64FromBytes(message.chunk) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<PoolMessagePackageWithOnlyChunk>, I>>(
    object: I,
  ): PoolMessagePackageWithOnlyChunk {
    const message = createBasePoolMessagePackageWithOnlyChunk();
    message.chunk = object.chunk ?? undefined;
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

function bytesFromBase64(b64: string): Uint8Array {
  if (tsProtoGlobalThis.Buffer) {
    return Uint8Array.from(tsProtoGlobalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = tsProtoGlobalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (tsProtoGlobalThis.Buffer) {
    return tsProtoGlobalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return tsProtoGlobalThis.btoa(bin.join(""));
  }
}

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
