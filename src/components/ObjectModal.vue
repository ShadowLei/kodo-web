<script setup lang="ts">

export interface IObjectModalData {
    subject?: string;
    id?: string;
    data: {
        key: string;
        val: string;
    }[];
    ok_text?: string;
    close_text?: string;
}

export interface IObjectModalDataMethod {
    openObjectModal: () => void;
}

const props = withDefaults(defineProps<IObjectModalData>(), {
    subject: "",
    id: "",
    ok_text: "OK",
    close_text: "X",
    popup: false,
});

function openObjectModal() {
    document.getElementById('btnObjectPopupModal')?.click();
}

defineExpose<IObjectModalDataMethod>({
    openObjectModal: openObjectModal
});

</script>

<style>
#btnObjectPopupModal {
    display: none;
}
</style>

<template>
    <!-- Button trigger modal -->
    <button type="button" id="btnObjectPopupModal" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#popObject">
        {{ subject }}
    </button>

    <!-- Modal -->
    <div class="modal fade" id="popObject" tabindex="-1" aria-labelledby="popObjectLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h1 class="modal-title fs-5" id="popObjectLabel">{{ subject }}: {{ id }}</h1>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body form">
                    <div class="row" v-for="item in data">
                        <div class="input-group">
                            <span class="col-3 input-group-text">{{ item.key }} :</span>
                            <span class="col-9 input-group-text">{{ item.val }} </span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="col text-end">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">{{ close_text }}</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>