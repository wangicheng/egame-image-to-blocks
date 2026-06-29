// 將十六進位顏色字串 (例如 "#RRGGBB") 轉換為 RGB 陣列 [R, G, B]。
function hexToRgb(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return [r, g, b];
}

// 圖片轉換核心邏輯
function convertImageToNumberString(imageSrc, availableColors, indexMap, ditherStrength = 0.0) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            const canvas = document.getElementById('imageCanvas');
            const ctx = canvas.getContext('2d');
            const targetWidth = 80;
            const targetHeight = 80;
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            
            // 保持最近鄰居法 (保留邊緣銳利度)
            ctx.imageSmoothingEnabled = false; 
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            const width = canvas.width;
            const height = canvas.height;
            let numberString = '';

            if (!Array.isArray(availableColors) || availableColors.some(color => !Array.isArray(color) || color.length !== 3)) {
                reject(new Error("可用顏色 (availableColors) 格式不正確。"));
                return;
            }

            // 顏色距離計算 (優化效能版，直接取平方和)
            function colorDistanceSquared(color1, color2) {
                const dr = color1[0] - color2[0];
                const dg = color1[1] - color2[1];
                const db = color1[2] - color2[2];
                return (dr * dr) + (dg * dg) + (db * db);
            }

            const getIndex = (x, y) => (y * width + x) * 4;

            // Dither Strength (由參數傳入): 設為 1.0 是標準抖動，設為 0.5 噪點少一半，設為 0.0 完全無抖動(純色塊) 

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = getIndex(x, y);

                    const oldR = pixels[idx];
                    const oldG = pixels[idx + 1];
                    const oldB = pixels[idx + 2];

                    let minDistance = Infinity;
                    let closestColorIndex = -1;

                    // 找出色盤中最接近的顏色
                    for (let j = 0; j < availableColors.length; j++) {
                        const distance = colorDistanceSquared([oldR, oldG, oldB], availableColors[j]);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestColorIndex = j;
                        }
                    }

                    const mappedIndex = indexMap[closestColorIndex];
                    numberString += String(mappedIndex);

                    const newColor = availableColors[closestColorIndex];
                    
                    // 計算捨棄的誤差，並乘上「抖動強度」來削弱副作用
                    const errR = (oldR - newColor[0]) * ditherStrength;
                    const errG = (oldG - newColor[1]) * ditherStrength;
                    const errB = (oldB - newColor[2]) * ditherStrength;

                    // 將當前像素值替換成量化後的色盤顏色，以便在畫布上呈現最終結果
                    pixels[idx] = newColor[0];
                    pixels[idx + 1] = newColor[1];
                    pixels[idx + 2] = newColor[2];

                    // Atkinson 矩陣將誤差平分為 8 份，但只把 6 份擴散出去 (總共只擴散 75%)
                    // 這會讓顏色允許「跑掉」25%，從而產生大面積乾淨的色塊，減少沙粒感。
                    const eR = errR * 0.125; // 1/8 的誤差
                    const eG = errG * 0.125;
                    const eB = errB * 0.125;

                    // 輔助函式：快速將誤差加上去
                    const addError = (offsetX, offsetY) => {
                        const nx = x + offsetX;
                        const ny = y + offsetY;
                        if (nx >= 0 && nx < width && ny < height) {
                            const i = getIndex(nx, ny);
                            pixels[i]     += eR;
                            pixels[i + 1] += eG;
                            pixels[i + 2] += eB;
                        }
                    };

                    // Atkinson 矩陣的擴散位置：
                    addError(1, 0);  // 右 (x+1, y)
                    addError(2, 0);  // 右二 (x+2, y)
                    addError(-1, 1); // 左下 (x-1, y+1)
                    addError(0, 1);  // 下 (x, y+1)
                    addError(1, 1);  // 右下 (x+1, y+1)
                    addError(0, 2);  // 下二 (x, y+2)
                }
            }

            // 將轉換後的像素資料繪製到預覽畫布上
            const previewCanvas = document.getElementById('previewCanvas');
            if (previewCanvas) {
                const previewCtx = previewCanvas.getContext('2d');
                previewCanvas.width = targetWidth;
                previewCanvas.height = targetHeight;
                previewCtx.putImageData(imageData, 0, 0);
            }
            
            resolve(numberString);
        };

        img.onerror = (error) => {
            reject(new Error(`圖片載入失敗: ${error.message || '未知錯誤'}`));
        };

        img.src = imageSrc;
    });
}

/**
 * 將數字字串轉換成積木 XML 格式。
 * @param {string} numberString - 轉換後的數字字串。
 * @returns {string} - 轉換後的積木 XML。
 */
function textToBlocks(numberString, hexColors, newIndexMap) {
    const string_v_left = `<block type="procedures_defreturn" collapsed="true" x="0" y="0"><mutation><arg name="array"></arg><arg name="prefix"></arg><arg name="_i"></arg></mutation><field name="NAME">array_next</field><statement name="STACK"><block type="procedures_ifreturn"><mutation value="1"></mutation><value name="CONDITION"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="variables_get"><field name="VAR">prefix</field></block></value><value name="B"><block type="variables_get"><field name="VAR">array</field></block></value></block></value><value name="VALUE"><block type="math_number"><field name="NUM">-1</field></block></value><next><block type="controls_for"><field name="VAR">_i</field><value name="TO"><block type="math_number"><field name="NUM">8</field></block></value><statement name="DO"><block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">GT</field><value name="A"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="variables_get"><field name="VAR">prefix</field></block></value><value name="B"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="variables_get"><field name="VAR">_i</field></block></value><value name="B"><block type="math_number"><field name="NUM">1</field></block></value></block></value></block></value><value name="B"><block type="variables_get"><field name="VAR">array</field></block></value></block></value><statement name="DO0"><block type="controls_flow_statements"><field name="FLOW">BREAK</field></block></statement></block></statement></block></next></block></statement><value name="RETURN"><block type="variables_get"><field name="VAR">_i</field></block></value></block><block type="procedures_defnoreturn" collapsed="true" x="0" y="52"><mutation><arg name="color"></arg></mutation><field name="NAME">choose</field><statement name="STACK"><block type="controls_if"><mutation elseif="69" else="1"></mutation>`;
    const string_v_right = `<statement name="ELSE"><block type="draw_colour"><value name="COLOUR"><block type="variables_get"><field name="VAR">transparent</field></block></value></block></statement></block></statement></block><block type="variables_set" x="0" y="104"><field name="VAR">data</field><value name="VALUE"><block type="colour_picker"><field name="COLOUR">#000000</field></block></value><next><block type="variables_set"><field name="VAR">prefix</field><value name="VALUE"><block type="colour_picker"><field name="COLOUR">#000000</field></block></value><next><block xmlns="http://www.w3.org/1999/xhtml" type="variables_set" collapsed="true"><field name="VAR">data</field><value name="VALUE">`;
    const string_w = `<block type="math_arithmetic" inline="false"><field name="OP">ADD</field><value name="A">`;
    const string_x = `<block type="variables_get"><field name="VAR">data</field></block>`;
    const string_y_left = `</value><value name="B"><block type="math_number"><field name="NUM">`;
    const string_y_right = `</field></block></value></block>`;
    const string_z = `</value><next><block type="variables_set"><field name="VAR">transparent</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="variables_get"><field name="VAR">prefix</field></block></value></block></value></block></value><next><block type="jump"><field name="DIR">jumpForward</field><value name="VALUE"><block type="math_number"><field name="NUM">197.5</field></block></value><next><block type="draw_turn"><field name="DIR">turnRight</field><value name="VALUE"><block type="math_number"><field name="NUM">90</field></block></value><next><block type="jump"><field name="DIR">jumpBackward</field><value name="VALUE"><block type="math_number"><field name="NUM">197.5</field></block></value><next><block type="controls_repeat_ext"><value name="TIMES"><block type="math_number"><field name="NUM">80</field></block></value><statement name="DO"><block type="controls_repeat_ext"><value name="TIMES"><block type="math_number"><field name="NUM">80</field></block></value><statement name="DO"><block type="variables_set"><field name="VAR">color</field><next><block type="controls_repeat_ext"><value name="TIMES"><block type="math_number"><field name="NUM">2</field></block></value><statement name="DO"><block type="variables_set"><field name="VAR">next</field><value name="VALUE"><block type="procedures_callreturn"><mutation name="array_next"><arg name="array"></arg><arg name="prefix"></arg><arg name="_i"></arg></mutation><value name="ARG0"><block type="variables_get"><field name="VAR">data</field></block></value><value name="ARG1"><block type="variables_get"><field name="VAR">prefix</field></block></value></block></value><next><block type="variables_set"><field name="VAR">prefix</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="variables_get"><field name="VAR">prefix</field></block></value><value name="B"><block type="variables_get"><field name="VAR">next</field></block></value></block></value><next><block type="variables_set"><field name="VAR">color</field><value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field><value name="A"><block type="math_arithmetic"><field name="OP">MULTIPLY</field><value name="A"><block type="variables_get"><field name="VAR">color</field></block></value><value name="B"><block type="math_number"><field name="NUM">10</field></block></value></block></value><value name="B"><block type="variables_get"><field name="VAR">next</field></block></value></block></value></block></next></block></next></block></statement><next><block type="procedures_callnoreturn"><mutation name="choose"><arg name="color"></arg></mutation><value name="ARG0"><block type="variables_get"><field name="VAR">color</field></block></value><next><block type="draw_move"><field name="DIR">moveForward</field><next><block type="jump"><field name="DIR">jumpForward</field><value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value></block></next></block></next></block></next></block></next></block></statement><next><block type="jump"><field name="DIR">jumpBackward</field><value name="VALUE"><block type="math_number"><field name="NUM">400</field></block></value><next><block type="draw_turn"><field name="DIR">turnRight</field><value name="VALUE"><block type="math_number"><field name="NUM">90</field></block></value><next><block type="jump"><field name="DIR">jumpForward</field><value name="VALUE"><block type="math_number"><field name="NUM">5</field></block></value><next><block type="draw_turn"><field name="DIR">turnLeft</field><value name="VALUE"><block type="math_number"><field name="NUM">90</field></block></value></block></next></block></next></block></next></block></next></block></next></block>`;
    let result_v = "";
    let result_y = "";
    for (let i = 0; i < hexColors.length; i++) {
        result_v += `<value name="IF${i}"><block type="logic_compare"><field name="OP">EQ</field><value name="A"><block type="variables_get"><field name="VAR">color</field></block></value><value name="B"><block type="math_number"><field name="NUM">${newIndexMap[i]}</field></block></value></block></value><statement name="DO${i}"><block type="draw_colour"><value name="COLOUR"><block type="colour_picker"><field name="COLOUR">${hexColors[i]}</field></block></value></block></statement>`;
    }
    result_v = string_v_left + result_v + string_v_right;

    const chunkSize = 16;
    let repeat = 0;
    for (let i = 0; i < numberString.length; i += chunkSize) {
        const chunk = numberString.substring(i, i + chunkSize);
        result_y += string_y_left + chunk + string_y_right;
        repeat++;
    }

    return result_v + string_w.repeat(repeat) + string_x + result_y + string_z;
}

// 顯示訊息框
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = message;
    messageBox.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700', 'bg-blue-100', 'text-blue-700');
    if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-700');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'text-green-700');
    } else {
        messageBox.classList.add('bg-blue-100', 'text-blue-700');
    }
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// DOM 元素
const imageUpload = document.getElementById('imageUpload');
const imageCanvas = document.getElementById('imageCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const canvasMessage = document.getElementById('canvasMessage');
const ditherStrengthSlider = document.getElementById('ditherStrength');
const ditherStrengthValue = document.getElementById('ditherStrengthValue');
// MODIFIED: Variable name updated for clarity
const blocklyXmlOutput = document.getElementById('blocklyXmlOutput');
const copyButton = document.getElementById('copyButton');
const dropArea = document.getElementById('dropArea');

const hexColors = [
    "#ffffff", "#cccccc", "#c0c0c0", "#999999", "#666666", "#333333", "#000000", "#ffcccc", "#ff6666", "#ff0000", "#cc0000", "#990000", "#660000", "#330000", "#ffcc99", "#ff9966", "#ff9900", "#ff6600", "#cc6600", "#993300", "#663300", "#ffff99", "#ffff66", "#ffcc66", "#ffcc33", "#cc9933", "#996633", "#663333", "#ffffcc", "#ffff33", "#ffff00", "#ffcc00", "#999900", "#666600", "#333300", "#99ff99", "#66ff99", "#33ff33", "#33cc00", "#009900", "#006600", "#003300", "#99ffff", "#33ffff", "#66cccc", "#00cccc", "#339999", "#336666", "#003333", "#ccffff", "#66ffff", "#33ccff", "#3366ff", "#3333ff", "#000099", "#000066", "#ccccff", "#9999ff", "#6666cc", "#6633ff", "#6600cc", "#333399", "#330099", "#ffccff", "#ff99ff", "#cc66cc", "#cc33cc", "#993399", "#663366", "#330033"
];

const availableColorsRgb = hexColors.map(hexToRgb);

const newIndexMap = [];
let currentNum = 12;
while (newIndexMap.length < hexColors.length) {
    if (currentNum % 10 !== 0) {
        newIndexMap.push(currentNum);
    }
    currentNum++;
}

let currentImageUrl = null;

async function runConversion(showToast = false) {
    if (!currentImageUrl) return;

    canvasMessage.textContent = '正在轉換圖片...';
    blocklyXmlOutput.value = '轉換中...';
    copyButton.disabled = true;

    // 清除上一次的預覽
    if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }

    try {
        const ditherStrength = ditherStrengthSlider ? (parseFloat(ditherStrengthSlider.value) / 100) : 0.0;
        const numberString = await convertImageToNumberString(currentImageUrl, availableColorsRgb, newIndexMap, ditherStrength);
        const resultXml = textToBlocks(numberString, hexColors, newIndexMap);
        blocklyXmlOutput.value = resultXml;
        copyButton.disabled = false;
        canvasMessage.textContent = '圖片已載入並轉換完成';
        if (showToast) {
            showMessage('圖片轉換成功！', 'success');
        }
    } catch (error) {
        console.error("轉換圖片時發生錯誤:", error);
        blocklyXmlOutput.value = '轉換失敗，請檢查主控台。';
        copyButton.disabled = true;
        canvasMessage.textContent = '圖片載入或轉換失敗';
        showMessage(`錯誤: ${error.message}`, 'error');
    }
}

async function processFiles(files) {
    if (files.length === 0) {
        currentImageUrl = null;
        blocklyXmlOutput.value = '';
        copyButton.disabled = true;
        canvasMessage.textContent = '請選擇圖片';
        return;
    }

    const file = files[0];

    if (!file.type.startsWith('image/')) {
        showMessage('請上傳圖片檔案 (例如 .jpg, .png, .gif)', 'error');
        currentImageUrl = null;
        blocklyXmlOutput.value = '';
        copyButton.disabled = true;
        canvasMessage.textContent = '請選擇圖片';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        currentImageUrl = e.target.result;
        await runConversion(true);
    };
    reader.readAsDataURL(file);
}

// --- 事件監聽器 ---

imageUpload.addEventListener('change', (event) => {
    processFiles(event.target.files);
});

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', (e) => {
    e.stopPropagation();
    dropArea.classList.remove('drag-over');
});

dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropArea.classList.remove('drag-over');
    processFiles(e.dataTransfer.files);
});

document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                processFiles([file]);
                break;
            }
        }
    }
});

copyButton.addEventListener('click', () => {
    const textToCopy = blocklyXmlOutput.value;

    if (textToCopy) {
        const tempInput = document.createElement('textarea');
        tempInput.value = textToCopy;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                showMessage('已成功複製到剪貼簿！', 'success');
            } else {
                showMessage('複製失敗，請手動複製。', 'error');
            }
        } catch (err) {
            console.error('複製時發生錯誤:', err);
            showMessage('複製時發生錯誤，請手動複製。', 'error');
        }
        document.body.removeChild(tempInput);
    } else {
        showMessage('沒有內容可以複製。', 'info');
    }
});

// 抖動強度調整事件監聽
if (ditherStrengthSlider && ditherStrengthValue) {
    ditherStrengthSlider.addEventListener('input', () => {
        const val = ditherStrengthSlider.value;
        ditherStrengthValue.textContent = `${val}%`;
        runConversion(false);
    });
}

// 初始化狀態
blocklyXmlOutput.value = '';
copyButton.disabled = true;
canvasMessage.textContent = '請選擇圖片以開始，或拖曳、貼上圖片。';