<script setup lang="ts">
import type { IQueryOnData } from '@/_modules';
import { reactive, ref } from 'vue';

export interface IPropertyModalData {
    subject?: string;
    objectid?: string;
    id?: string;
    op?: string;
    val: string;
    data?: object;
    ok_text?: string;
    close_text?: string;
}

export interface IPropertyModalDataMethod {
    openPropertyModal: (val: string) => void;
}

const props = withDefaults(defineProps<IPropertyModalData>(), {
    subject: "",
    objectid: "",
    id: "",
    op: "==",
    val: "",
    ok_text: "OK",
    close_text: "X",
    popup: false,
});

const queryVal = ref("");
const emit = defineEmits(['update:val']);

function openPropertyModal(val: string) {
    console.log(`val: ${val}`);
    queryVal.value = val;

    document.getElementById('btnPropertyPopupModal')?.click();
}

function btnQueryClick() {
    let data: IQueryOnData = {
        id: props.id,
        val: queryVal.value,
        op: props.op,
        data: props.data as any
    };
    
    emit("update:val", data);

    var closeButton = document.getElementById('btnPropertyModalClose');
    closeButton?.click();
}

defineExpose<IPropertyModalDataMethod>({
    openPropertyModal: openPropertyModal
});


/*
const queryVal = computed({
    get() {
        return props.val
    },
    set(value) {
        emit('update:val', value)
    }
});
*/

</script>

<style>
#btnPropertyPopupModal {
    display: none;
}
</style>

<template>
    <!-- Button trigger modal -->
    <button type="button" id="btnPropertyPopupModal" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#popProperty">
        {{ subject }}
    </button>

    <!-- Modal -->
    <div class="modal fade" id="popProperty" tabindex="-1" aria-labelledby="popPropertyLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="popPropertyLabel">{{ subject }}: {{ objectid }}</h1>
                    <button type="button" id="btnPropertyModalClose" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="input-group flex-nowrap">
                        <span class="input-group-text">{{ id }} {{ op }} </span>
                        <!--input type="text" v-model="queryVal" class="form-control" :placeholder="id" :aria-label="id" aria-describedby="addon-wrapping"-->
                        <input id="popPropertyInput" type="text" v-model="queryVal" />
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="col text-start">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ close_text }}</button>
                    </div>
                    <div class="col text-end">
                        <button type="button" class="btn btn-primary" @click="btnQueryClick">{{ ok_text }}</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>