
export type KodoType = "string" | "number" | "bigint" | "boolean" | "object";

export interface IKodoProperty<T = any> {
    name: keyof T & string;
    type?: KodoType;
    allowNull?: boolean;
}

export interface IKodoObject<T = any> {
    name: string;
    properties: IKodoProperty<T>[];
}