/**
 * Cryptara — script.js
 * Handles AES-256 encryption and decryption using CryptoJS.
 * All operations are client-side; no data is transmitted.
 */

"use strict";

/* =========================================================
   Constants & DOM references
   ========================================================= */
const ENCRYPTION_ITERATIONS = 10000; // PBKDF2 iterations for key derivation

// Mode state
let currentMode = "encrypt"; // "encrypt" | "decrypt"

// DOM
const btnEncrypt       = document.getElementById("btn-encrypt");
const btnDecrypt       = document.getElementById("btn-decrypt");
const textInput        = document.getElementById("text-input");
const passphraseInput  = document.getElementById("passphrase");
const togglePassBtn    = document.getElementById("toggle-pass");
const eyeIcon          = document.getElementById("eye-icon");
const actionBtn        = document.getElementById("action-btn");
const actionIcon       = document.getElementById("action-icon");
const actionLabel      = document.getElementById("action-label");
const outputBox        = document.getElementById("output-box");
const outputPlaceholder= document.getElementById("output-placeholder");
const outputText       = document.getElementById("output-text");
const copyBtn          = document.getElementById("copy-btn");
const statusMsg        = document.getElementById("status-message");
const inputLabel       = document.getElementById("input-label");
const outputLabel      = document.getElementById("output-label");
const dividerIcon      = document.getElementById("divider-icon");

/* =========================================================
   Mode switching
   ========================================================= */
/**
 * Switch between Encrypt and Decrypt modes.
 * Updates UI labels, icons, and placeholders accordingly.
 * @param {string} mode - "encrypt" or "decrypt"
 */
function setMode(mode) {
  currentMode = mode;

  // Toggle active state on buttons
  btnEncrypt.classList.toggle("active", mode === "encrypt");
  btnDecrypt.classList.toggle("active", mode === "decrypt");

  if (mode === "encrypt") {
    // Encrypt UI labels
    inputLabel.innerHTML  = '<i class="fa-solid fa-pen-to-square"></i> Plaintext Input';
    outputLabel.innerHTML = '<i class="fa-solid fa-lock"></i> Ciphertext Output';
    textInput.placeholder = "Enter text to encrypt…";
    actionIcon.className  = "fa-solid fa-lock";
    actionLabel.textContent = "Encrypt Text";
    dividerIcon.className = "fa-solid fa-chevron-right divider-icon";
  } else {
    // Decrypt UI labels
    inputLabel.innerHTML  = '<i class="fa-solid fa-unlock"></i> Ciphertext Input';
    outputLabel.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Plaintext Output';
    textInput.placeholder = "Paste encrypted ciphertext here…";
    actionIcon.className  = "fa-solid fa-unlock";
    actionLabel.textContent = "Decrypt Text";
    dividerIcon.className = "fa-solid fa-chevron-right divider-icon";
  }

  // Clear previous results when switching modes
  clearOutput();
  hideStatus();
}

/* =========================================================
   Core cryptographic functions (AES-256-CBC via CryptoJS)
   ========================================================= */

/**
 * Derive a 256-bit AES key from a passphrase using PBKDF2.
 * @param {string} passphrase - User-supplied passphrase
 * @param {CryptoJS.lib.WordArray} salt - Random 128-bit salt
 * @returns {CryptoJS.lib.WordArray} Derived key
 */
function deriveKey(passphrase, salt) {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,        // 256-bit key (8 words × 32 bits)
    iterations: ENCRYPTION_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  });
}

/**
 * Encrypt plaintext with AES-256-CBC.
 * Returns a Base64 string in the format: salt(32hex) + iv(32hex) + ciphertext(base64)
 *
 * @param {string} plaintext  - Text to encrypt
 * @param {string} passphrase - Secret passphrase
 * @returns {string} Encoded ciphertext string
 */
function encryptText(plaintext, passphrase) {
  if (!plaintext) throw new Error("Please enter some text to encrypt.");
  if (!passphrase) throw new Error("Please enter a passphrase.");

  // Generate random 128-bit salt and IV
  const salt = CryptoJS.lib.WordArray.random(16);  // 128 bits = 16 bytes
  const iv   = CryptoJS.lib.WordArray.random(16);  // 128 bits = 16 bytes

  // Derive key from passphrase + salt
  const key = deriveKey(passphrase, salt);

  // Perform AES-256-CBC encryption
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // Encode: saltHex + ivHex + ciphertextBase64 (pipe-separated)
  const saltHex   = salt.toString(CryptoJS.enc.Hex);       // 32 hex chars
  const ivHex     = iv.toString(CryptoJS.enc.Hex);         // 32 hex chars
  const cipherB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);

  // Combine all parts with a delimiter for easy parsing
  return `${saltHex}|${ivHex}|${cipherB64}`;
}

/**
 * Decrypt a ciphertext string produced by encryptText().
 *
 * @param {string} cipherString - Encoded string (salt|iv|ciphertext)
 * @param {string} passphrase   - Secret passphrase
 * @returns {string} Decrypted plaintext
 * @throws  {Error}  If the format is wrong or decryption fails
 */
function decryptText(cipherString, passphrase) {
  if (!cipherString) throw new Error("Please paste the encrypted ciphertext.");
  if (!passphrase)   throw new Error("Please enter the passphrase used for encryption.");

  // Split the encoded string into its components
  const parts = cipherString.trim().split("|");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format. Make sure you pasted the full encrypted output.");
  }

  const [saltHex, ivHex, cipherB64] = parts;

  // Validate hex lengths (16 bytes = 32 hex chars)
  if (saltHex.length !== 32 || ivHex.length !== 32) {
    throw new Error("Corrupted ciphertext: salt or IV length mismatch.");
  }

  // Parse components back to WordArrays
  const salt     = CryptoJS.enc.Hex.parse(saltHex);
  const iv       = CryptoJS.enc.Hex.parse(ivHex);
  const cipherWA = CryptoJS.enc.Base64.parse(cipherB64);

  // Re-derive the key with the same passphrase + stored salt
  const key = deriveKey(passphrase, salt);

  // Build CipherParams object for CryptoJS
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: cipherWA });

  // Perform AES-256-CBC decryption
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // Convert result to UTF-8 string
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

  // An empty result usually means the passphrase is wrong
  if (!plaintext) {
    throw new Error("Decryption failed. The passphrase is incorrect or the ciphertext is corrupted.");
  }

  return plaintext;
}

/* =========================================================
   UI helpers
   ========================================================= */

/**
 * Display a result in the output panel.
 * @param {string} text - Text to show
 */
function showOutput(text) {
  outputPlaceholder.style.display = "none";
  outputText.style.display = "block";
  outputText.value = text;
}

/** Reset the output panel to its placeholder state. */
function clearOutput() {
  outputPlaceholder.style.display = "flex";
  outputText.style.display = "none";
  outputText.value = "";
}

/**
 * Show a status message below the output panel.
 * @param {string} message - Message text (HTML supported for icon)
 * @param {"success"|"error"|"info"} type - Styling variant
 */
function showStatus(message, type) {
  statusMsg.innerHTML = message;
  statusMsg.className = `status-message show ${type}`;
}

/** Hide the status message. */
function hideStatus() {
  statusMsg.className = "status-message";
}

/* =========================================================
   Main action handler
   ========================================================= */

/**
 * Execute encrypt or decrypt based on currentMode.
 * Validates inputs and handles errors gracefully.
 */
function handleAction() {
  const inputVal      = textInput.value.trim();
  const passphraseVal = passphraseInput.value;

  hideStatus();

  // Validate: text present
  if (!inputVal) {
    showStatus(
      `<i class="fa-solid fa-triangle-exclamation"></i> Please enter some ${currentMode === "encrypt" ? "plaintext to encrypt" : "ciphertext to decrypt"}.`,
      "error"
    );
    textInput.focus();
    return;
  }

  // Validate: passphrase present
  if (!passphraseVal) {
    showStatus(
      '<i class="fa-solid fa-triangle-exclamation"></i> Please enter a passphrase.',
      "error"
    );
    passphraseInput.focus();
    return;
  }

  try {
    if (currentMode === "encrypt") {
      // ── Encrypt ──────────────────────────────────────────
      const cipher = encryptText(inputVal, passphraseVal);
      showOutput(cipher);
      showStatus(
        '<i class="fa-solid fa-check-circle"></i> Text encrypted successfully! Copy the ciphertext and keep your passphrase safe.',
        "success"
      );

    } else {
      // ── Decrypt ──────────────────────────────────────────
      const plain = decryptText(inputVal, passphraseVal);
      showOutput(plain);
      showStatus(
        '<i class="fa-solid fa-check-circle"></i> Decryption successful! Your original text has been recovered.',
        "success"
      );
    }
  } catch (err) {
    // Graceful error display – never expose internal stack traces
    clearOutput();
    showStatus(
      `<i class="fa-solid fa-circle-xmark"></i> ${err.message}`,
      "error"
    );
  }
}

/* =========================================================
   Clipboard
   ========================================================= */

/** Copy output text to clipboard and give visual feedback. */
async function copyOutput() {
  const text = outputText.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add("copied");
    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    }, 2000);
  } catch {
    // Fallback for older browsers
    outputText.select();
    document.execCommand("copy");
    showStatus('<i class="fa-solid fa-check-circle"></i> Copied to clipboard.', "info");
  }
}

/* =========================================================
   Passphrase visibility toggle
   ========================================================= */

/** Toggle the passphrase field between password and text type. */
function togglePassphraseVisibility() {
  const isHidden = passphraseInput.type === "password";
  passphraseInput.type = isHidden ? "text" : "password";
  eyeIcon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

/* =========================================================
   Character / strength indicator (optional UX touch)
   ========================================================= */

/** Simple passphrase strength heuristic – updates hint colour */
function assessPassphrase(val) {
  const hint = document.querySelector(".key-hint");
  if (!hint) return;

  if (!val) {
    hint.style.color = "";
    return;
  }
  const strength = val.length >= 16 ? "strong" : val.length >= 8 ? "medium" : "weak";
  const colours  = { strong: "#4ade80", medium: "#facc15", weak: "#f87171" };
  hint.style.color = colours[strength];
}

/* =========================================================
   Event listeners
   ========================================================= */

// Mode toggle buttons
btnEncrypt.addEventListener("click", () => setMode("encrypt"));
btnDecrypt.addEventListener("click", () => setMode("decrypt"));

// Main action
actionBtn.addEventListener("click", handleAction);

// Allow Ctrl+Enter in textareas as shortcut to run action
textInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") handleAction();
});

// Copy output
copyBtn.addEventListener("click", copyOutput);

// Passphrase toggle
togglePassBtn.addEventListener("click", togglePassphraseVisibility);

// Passphrase strength
passphraseInput.addEventListener("input", () => assessPassphrase(passphraseInput.value));

// Clear status on new input
textInput.addEventListener("input", hideStatus);
passphraseInput.addEventListener("input", hideStatus);

/* =========================================================
   Initialise
   ========================================================= */
setMode("encrypt"); // start in encrypt mode
