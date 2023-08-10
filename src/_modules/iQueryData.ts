
export interface IQueryOnData {
    id: string;
    op: string;
    val: string;
    data: {
        $ns: string;
        $name: string;
    }
}