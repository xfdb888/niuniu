'use strict';

const crypto = require('crypto');

/**
 * TOTP 实现（基于 RFC 6238）
 * 用于生成和验证时间戳 OTP（常见于 Google Authenticator）
 */
class TOTP {
    constructor(secret, options = {}) {
        this.secret = secret;
        this.window = options.window || 1; // 允许前后各 1 个时间窗口的容差
        this.timeStep = options.timeStep || 30; // 每 30 秒生成一个新 OTP
    }

    /**
     * 生成 Base32 编码的随机密钥（用于初始化 MFA）
     */
    static generateSecret() {
        const randomBytes = crypto.randomBytes(20);
        return base32Encode(randomBytes);
    }

    /**
     * 获取当前 TOTP 值（调试用）
     */
    now() {
        return this.generate(Math.floor(Date.now() / 1000));
    }

    /**
     * 基于时间戳生成 OTP
     */
    generate(timestamp) {
        const timeCounter = Math.floor(timestamp / this.timeStep);
        const hmac = crypto.createHmac('sha1', base32Decode(this.secret));
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64BE(BigInt(timeCounter));
        hmac.update(buffer);
        const digest = hmac.digest();
        const offset = digest[digest.length - 1] & 0xf;
        const code = (digest[offset] & 0x7f) << 24
            | (digest[offset + 1] & 0xff) << 16
            | (digest[offset + 2] & 0xff) << 8
            | (digest[offset + 3] & 0xff);
        return (code % 1000000).toString().padStart(6, '0');
    }

    /**
     * 验证 TOTP（考虑时间窗口容差）
     */
    verify(token) {
        if (!token || token.length !== 6) {
            return false;
        }
        const now = Math.floor(Date.now() / 1000);
        for (let i = -this.window; i <= this.window; i++) {
            const testTime = now + (i * this.timeStep);
            if (this.generate(testTime) === token) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Base32 编码
 */
function base32Encode(buf) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
}

/**
 * Base32 解码
 */
function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const output = [];
    for (let i = 0; i < str.length; i++) {
        value = (value << 5) | alphabet.indexOf(str[i]);
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

/**
 * 生成 QR Code URI（用于 Google Authenticator 等）
 */
function generateQRCodeURI(adminId, adminName, secret, issuer = 'NiuNiu Admin') {
    const label = encodeURIComponent(`${issuer} (${adminName})`);
    const params = [
        `secret=${secret}`,
        `issuer=${encodeURIComponent(issuer)}`,
        `accountname=${encodeURIComponent(`${adminName} <${adminId}>`)}`,
    ].join('&');
    return `otpauth://totp/${label}?${params}`;
}

module.exports = {
    TOTP,
    generateSecret: TOTP.generateSecret,
    generateQRCodeURI,
};
