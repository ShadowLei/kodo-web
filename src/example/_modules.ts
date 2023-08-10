
export class Order {
    id!: string;

    logid!: string;

    operator?: string;

    price?: number;
    items?: Array<any>;

    createDate?: Date;
    updateDate?: Date;
}

export class Payment {
    id!: string;
    orderid!: string;
    amount!: number;

    operator?: string;

    createDate?: Date;
    updateDate?: Date;
}

export class PaymentDetail {
    id!: string;

    paymentid!: string;

    amount!: number;

    desc!: string;

    createDate?: Date;
    updateDate?: Date;
}

export class OrderOwner {
    id!: string;

    orderid!: string;

    name!: string;

    createDate?: Date;
    updateDate?: Date;
}
