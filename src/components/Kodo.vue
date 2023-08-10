<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { KodoCytoscape } from "../kodo";
import PropertyModal, { type IPropertyModalData, type IPropertyModalDataMethod } from "./PropertyModal.vue"
import { initKodoExample, initKodoExampleWithData } from '../example';
import type { Kodo } from 'kodo-core';
import type { Core } from 'cytoscape';
import ObjectModal, { type IObjectModalData, type IObjectModalDataMethod } from './ObjectModal.vue';


var kodoCyto: KodoCytoscape;

function bind(core: Core, kodo: Kodo) {
    kodoCyto = new KodoCytoscape();
    kodoCyto.init(core, kodo);
    
    initEvents();

    //kodo = initCytoscape();
    kodoCyto.resize();
    kodoCyto.refresh();
}

onMounted(() => {
    let { core, kodo } = initKodoExample("kodo");
    bind(core, kodo);
});

const propertyModalRef = ref<IPropertyModalDataMethod>();
const propertyData = reactive<IPropertyModalData>({
    subject: "Property Query On",
    id: "",
    val: "",
    objectid: "",
    data: {},
    ok_text: "Query",
    close_text: "Close",
});

const objectModalRef = ref<IObjectModalDataMethod>();
const objectData = reactive<IObjectModalData>({
    subject: "Object Card",
    id: "",
    data: [],
    ok_text: "Query",
    close_text: "Close",
});

function initEvents() {
    var cy = kodoCyto.core;
    cy?.on('tap', 'node', function (evt) {
        var node = evt.target;

        let data = node.data();

        if (data.$type === "parent") {
            //no popup on parent
            return;
        }
        else if (data.$type === "object" || data.$type === "start-object") {

            if (data.$data) {
                objectData.id = node.id();
                objectData.data = [];
                for (let key in data.$data) {
                    objectData.data.push({
                        key: key,
                        val: data.$data[key]
                    });
                }

                objectModalRef.value?.openObjectModal();
            } else {
                return;
            }
        }
        else {
            //for property, popup the query form
            propertyData.id = data.$name;
            propertyData.objectid = data.$ns;
            if (data.$data) {
                propertyData.data = data.$data;
            } else {
                propertyData.data = data;
            }
            let val = data.$val?.toString() || "";
            propertyData.val = val;

            propertyModalRef.value?.openPropertyModal(val);
        }

    });
}

function kodoQuery(val: any) {
    let nodes = kodoCyto.query(val);

    let { core, kodo } = initKodoExampleWithData("kodo", nodes);
    bind(core, kodo);
}

</script>

<template>
    <div class="container">
        <div class="row mt-3" id="kodo-header">
            <div class="col">
                <button type="button" class="btn btn-primary" @click="kodoCyto.center">Center</button>
            </div>
            <div class="col">
                <button type="button" class="btn btn-primary" @click="kodoCyto.refresh">Refresh</button>
            </div>
            <div class="col">
                <button type="button" class="btn btn-primary" @click="kodoCyto.zoom">Zoom</button>
            </div>
            <div class="col">
                <button type="button" class="btn btn-primary" @click="kodoCyto.resize">Resize</button>
            </div>
            <div class="col">
                <PropertyModal ref="propertyModalRef"
                    :id="propertyData.id"
                    :objectid="propertyData.objectid"
                    :subject="propertyData.subject"
                    :data="propertyData.data"
                    :val="propertyData.val"
                    @update:val="kodoQuery"
                ></PropertyModal>

                <ObjectModal ref="objectModalRef"
                    :id="objectData.id"
                    :subject="objectData.subject"
                    :data="objectData.data"
                ></ObjectModal>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col12">
                <div id="kodo">
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
#kodo {
    width: 100%;
    min-width: 500px;
    height: 100%;
    min-height: 500px;
    display: block;
}
</style>
