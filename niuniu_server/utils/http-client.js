"use strict";

const axios = require('axios');

// Simple http client adapter. Export a minimal API the codebase can use
// so we can migrate away from `request` incrementally.

const instance = axios.create({
    timeout: 10000,
    // keep defaults; callers can pass overrides
});

async function get(url, opts) {
    const res = await instance.get(url, opts);
    return res.data;
}

async function post(url, data, opts) {
    const res = await instance.post(url, data, opts);
    return res.data;
}

// helper for form-data/multipart using axios and native FormData when available
async function postMultipart(url, formData, opts) {
    // formData can be a standard FormData or an object of fields
    const headers = (formData && formData.getHeaders) ? formData.getHeaders() : {};
    const res = await instance.post(url, formData, Object.assign({}, { headers }, opts || {}));
    return res.data;
}

module.exports = {
    get,
    post,
    postMultipart,
    // expose raw axios instance for advanced usage
    instance
};
