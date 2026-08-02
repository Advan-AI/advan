declare module "ali-oss" {
  interface OSSOptions {
    region?: string;
    accessKeyId?: string;
    accessKeySecret?: string;
    bucket?: string;
    secure?: boolean;
    [key: string]: any;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    get(name: string): Promise<{ content: Buffer; res: any }>;
    put(name: string, file: any): Promise<any>;
    list(query?: any, options?: any): Promise<{ objects?: Array<{ name: string; etag?: string; eTag?: string }>; [key: string]: any }>;
    [key: string]: any;
  }
}

declare module "tablestore" {
  export namespace TableStore {
    export enum PrimaryKeyType {
      INTEGER = 1,
      STRING = 2,
      BINARY = 3,
    }

    export enum FieldType {
      LONG = 1,
      DOUBLE = 2,
      BOOLEAN = 3,
      KEYWORD = 4,
      TEXT = 5,
      VECTOR = 6,
    }

    export enum VectorDataType {
      FLOAT_32 = 2,
      VD_FLOAT_32 = 2,
    }

    export enum VectorMetricType {
      EUCLIDEAN = 0,
      COSINE = 1,
      VM_COSINE = 1,
      DOT_PRODUCT = 2,
    }

    export enum QueryType {
      MATCH_QUERY = 1,
      MATCH_PHRASE_QUERY = 2,
      TERM_QUERY = 3,
      RANGE_QUERY = 4,
      BOOL_QUERY = 5,
      KNN_VECTOR_QUERY = 6,
    }

    export enum ColumnReturnType {
      RETURN_ALL = 1,
      RETURN_SPECIFIED = 2,
      RETURN_NONE = 3,
    }

    export enum RowExistenceExpectation {
      IGNORE = 0,
      EXPECT_EXIST = 1,
      EXPECT_NOT_EXIST = 2,
    }

    export class Long {
      static fromNumber(val: number): any;
      toNumber(): number;
    }

    export class Condition {
      constructor(expectation: RowExistenceExpectation, filter: any);
    }

    export interface ClientOptions {
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
      instancename: string;
    }

    export class Client {
      constructor(options: ClientOptions);
      listTable(params: any, callback: (err: any, data: any) => void): void;
      createTable(params: any, callback: (err: any, data: any) => void): void;
      deleteTable(params: any, callback: (err: any, data: any) => void): void;
      createSearchIndex(params: any, callback: (err: any, data: any) => void): void;
      deleteSearchIndex(params: any, callback: (err: any, data: any) => void): void;
      putRow(params: any, callback: (err: any, data: any) => void): void;
      getRow(params: any, callback: (err: any, data: any) => void): void;
      search(params: any, callback: (err: any, data: any) => void): void;
    }
  }

  export default TableStore;
}
