// ==UserScript==
// @name         Apex Learning Quiz Cheat
// @namespace    https://github.com/paysonism
// @version      7.2
// @description  Highlights Correct Answers in Apex Learning Quiz Menus. Includes Image Support, AI Logic to get the complete right answer, and is 100% Undetected
// @author       paysonism
// @match        https://course.apexlearning.com/public/activity/*
// @match        https://*.apexvs.com/public/activity/*
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// @run-at       document-end
// @license      MIT
// ==/UserScript==
 
(function() {
    'use strict';
 
    // CONFIGURATION - MUST ADD API KEY!
    // ============================================
    const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Get a free key from: https://aistudio.google.com/app/apikey
    const DEBUG_MODE = false; // Set to true for console logging
 
    const MAX_IMAGE_WIDTH = 800;
    const MAX_IMAGE_HEIGHT = 800;
    const IMAGE_QUALITY = 0.85;
    // ============================================
 
    let lastQuestionText = '';
    let isProcessing = false;
    let progressInterval = null;
 
    function log(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }
 
    function logError(...args) {
        if (DEBUG_MODE) {
            console.error(...args);
        }
    }
 
    function hasQuizContent() {
        const hasStem = document.querySelector('.sia-question-stem') !== null;
        const hasQuestion = document.querySelector('kp-sia-question') !== null;
        const hasDistractors = document.querySelectorAll('.sia-distractor').length > 0;
        return hasStem || hasQuestion || hasDistractors;
    }
 
    function extractQuestion() {
        const siaQuestion = document.querySelector('kp-sia-question');
        if (siaQuestion) {
            const kpContent = siaQuestion.querySelector('kp-content');
            if (kpContent) {
                const generated = kpContent.querySelector('[class*="kp-generated"]');
                if (generated) {
                    return generated.textContent.trim();
                }
                const text = kpContent.textContent.trim();
                if (text) return text;
            }
        }
 
        const questionStem = document.querySelector('.sia-question-stem');
        if (questionStem) {
            const allElements = questionStem.querySelectorAll('*');
            for (let el of allElements) {
                if (el.className && el.className.includes('kp-generated')) {
                    const text = el.textContent.trim();
                    if (text) return text;
                }
            }
            const text = questionStem.textContent.trim();
            if (text) return text;
        }
 
        return null;
    }
 
    function resizeAndCompressImage(img) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
 
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
 
                log(`Original image size: ${width}x${height}`);
 
                if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
                    const ratio = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
 
                log(`Resized to: ${width}x${height}`);
 
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
 
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'));
                        return;
                    }
 
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        const base64data = reader.result.split(',')[1];
                        const originalSize = (base64data.length * 0.75 / 1024).toFixed(2);
                        log(`Compressed image size: ${originalSize} KB`);
 
                        resolve({
                            data: base64data,
                            mimeType: 'image/jpeg'
                        });
                    };
                    reader.onerror = () => reject(new Error('Failed to read blob'));
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', IMAGE_QUALITY);
 
            } catch (e) {
                reject(e);
            }
        });
    }
 
    async function extractImages() {
        const images = [];
        const questionArea = document.querySelector('kp-sia-question');
        if (!questionArea) return images;
 
        const imgElements = questionArea.querySelectorAll('img');
        log(`Found ${imgElements.length} images in question`);
 
        for (let imgEl of imgElements) {
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
 
                const imageLoadPromise = new Promise((resolve, reject) => {
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Failed to load image'));
 
                    if (imgEl.src) {
                        img.src = imgEl.src;
                    } else if (imgEl.dataset.src) {
                        img.src = imgEl.dataset.src;
                    } else {
                        reject(new Error('No image source found'));
                    }
                });
 
                await imageLoadPromise;
                const compressedImage = await resizeAndCompressImage(img);
                images.push(compressedImage);
                log('Image processed and compressed');
 
            } catch (error) {
                logError('Error processing image:', error);
 
                try {
                    if (imgEl.src && imgEl.src.startsWith('data:')) {
                        const base64Data = imgEl.src.split(',')[1];
                        const mimeType = imgEl.src.split(';')[0].split(':')[1];
                        images.push({
                            data: base64Data,
                            mimeType: mimeType
                        });
                        log('Used original base64 image (compression failed)');
                    }
                } catch (fallbackError) {
                    logError('Fallback also failed:', fallbackError);
                }
            }
        }
 
        return images;
    }
 
    function extractAnswers() {
        const answers = [];
        const distractors = document.querySelectorAll('.sia-distractor');
 
        distractors.forEach((distractor, index) => {
            const choiceLetter = distractor.querySelector('.sia-choice-letter')?.textContent.trim();
            let answerText = null;
 
            const kpContent = distractor.querySelector('kp-content');
            if (kpContent) {
                const generated = kpContent.querySelector('[class*="kp-generated"]');
                if (generated) {
                    answerText = generated.textContent.trim();
                } else {
                    answerText = kpContent.textContent.trim();
                }
            }
 
            if (!answerText) {
                const labelDiv = distractor.querySelector('.label');
                if (labelDiv) {
                    answerText = labelDiv.textContent.replace(choiceLetter || '', '').trim();
                }
            }
 
            if (answerText) {
                answers.push({
                    letter: choiceLetter || String.fromCharCode(65 + index) + '.',
                    text: answerText,
                    element: distractor
                });
            }
        });
 
        return answers;
    }
 
    function createProgressBar() {
        let progressBar = document.getElementById('gemini-progress-bar');
 
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.id = 'gemini-progress-bar';
            progressBar.style.cssText = `
                position: fixed;
                bottom: 25px;
                right: 25px;
                width: 200px;
                height: 6px;
                background: #e0e0e0;
                border-radius: 2px;
                overflow: hidden;
                z-index: 999999;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
 
            const progressFill = document.createElement('div');
            progressFill.id = 'gemini-progress-fill';
            progressFill.style.cssText = `
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #4285f4, #34a853);
                border-radius: 2px;
                transition: width 0.1s linear;
            `;
 
            progressBar.appendChild(progressFill);
            document.body.appendChild(progressBar);
        }
 
        return progressBar;
    }
 
    function showProgress() {
        const progressBar = createProgressBar();
        const progressFill = document.getElementById('gemini-progress-fill');
 
        progressBar.style.opacity = '0.75';
        progressFill.style.width = '0%';
 
        let progress = 0;
        const duration = 3000;
        const interval = 50;
        const increment = (interval / duration) * 100;
 
        if (progressInterval) {
            clearInterval(progressInterval);
        }
 
        progressInterval = setInterval(() => {
            progress += increment;
            if (progress >= 95) {
                progress = 95;
            }
            progressFill.style.width = progress + '%';
        }, interval);
    }
 
    function hideProgress(success = true) {
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
 
        const progressBar = document.getElementById('gemini-progress-bar');
        const progressFill = document.getElementById('gemini-progress-fill');
 
        if (progressBar && progressFill) {
            if (success) {
                progressFill.style.width = '100%';
                setTimeout(() => {
                    progressBar.style.opacity = '0';
                    setTimeout(() => {
                        progressFill.style.width = '0%';
                    }, 300);
                }, 300);
            } else {
                progressFill.style.background = '#ea4335';
                setTimeout(() => {
                    progressBar.style.opacity = '0';
                    setTimeout(() => {
                        progressFill.style.width = '0%';
                        progressFill.style.background = 'linear-gradient(90deg, #4285f4, #34a853)';
                    }, 300);
                }, 500);
            }
        }
    }
 
    function queryGemini(question, answers, images) {
        return new Promise((resolve, reject) => {
            if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
                reject(new Error('No API key configured'));
                return;
            }
 
            const answerList = answers.map(a => `${a.letter} ${a.text}`).join('\n');
 
            let prompt = `You are a knowledgeable assistant operating at a high school level. `;
 
            if (images.length > 0) {
                prompt += `Analyze the question carefully INCLUDING the provided image(s). The images may contain diagrams, charts, molecular structures, or other visual information needed to answer correctly. `;
            }
 
            prompt += `Provide ONLY the letter (A, B, C, or D) of the correct answer. Do not include any explanation or additional text - just the single letter.
 
Question: ${question}
 
Answer Options:
${answerList}
 
Think through the question logically and select the most accurate answer based on high school official correct answer trends. This is for a high school level quiz so use appropriate reasoning for that level.
 
Correct answer letter (A, B, C, or D only):`;
 
            const parts = [];
 
            if (images.length > 0) {
                log(`Including ${images.length} optimized image(s) in request`);
                images.forEach((img) => {
                    parts.push({
                        inline_data: {
                            mime_type: img.mimeType,
                            data: img.data
                        }
                    });
                });
            }
 
            parts.push({ text: prompt });
 
            const requestData = {
                contents: [{
                    parts: parts
                }]
            };
 
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
 
            log('Querying Gemini' + (images.length > 0 ? ' with vision' : ''));
 
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(requestData),
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
 
                        if (data.error) {
                            logError('API Error:', data.error);
                            reject(new Error(data.error.message));
                            return;
                        }
 
                        if (data.candidates && data.candidates.length > 0) {
                            const candidate = data.candidates[0];
                            let answer = null;
 
                            if (candidate.content && candidate.content.parts) {
                                if (Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
                                    const part = candidate.content.parts[0];
                                    if (part && part.text) {
                                        answer = part.text;
                                    }
                                }
                            }
 
                            if (answer) {
                                log('Full response text:', answer);
 
                                const letterMatch = answer.match(/\b[A-D]\b/i);
                                if (letterMatch) {
                                    const finalAnswer = letterMatch[0].toUpperCase();
                                    log('Extracted answer:', finalAnswer);
                                    resolve(finalAnswer);
                                } else {
                                    const anyLetter = answer.match(/[A-D]/i);
                                    if (anyLetter) {
                                        const finalAnswer = anyLetter[0].toUpperCase();
                                        log('Using first A-D found:', finalAnswer);
                                        resolve(finalAnswer);
                                    } else {
                                        reject(new Error('No A-D letter in response'));
                                    }
                                }
                            } else {
                                logError('No text in response');
 
                                if (candidate.finishReason === 'SAFETY') {
                                    reject(new Error('Response blocked by safety filter'));
                                } else if (candidate.finishReason === 'MAX_TOKENS') {
                                    reject(new Error('MAX_TOKENS issue'));
                                } else {
                                    reject(new Error(`No text (finish: ${candidate.finishReason})`));
                                }
                            }
                        } else {
                            reject(new Error('No candidates'));
                        }
                    } catch (e) {
                        logError('Parse error:', e);
                        reject(e);
                    }
                },
                onerror: function(error) {
                    logError('Request error:', error);
                    reject(error);
                }
            });
        });
    }
 
    function removeHighlights() {
        document.querySelectorAll('.sia-distractor').forEach(el => {
            const labelDiv = el.querySelector('.label');
            if (labelDiv) {
                labelDiv.style.color = '';
                labelDiv.style.fontWeight = '';
            }
        });
    }
 
    function highlightAnswer(answers, correctLetter) {
        const normalizedCorrect = correctLetter.replace(/[^A-D]/gi, '').trim().toUpperCase();
        log('Highlighting answer:', normalizedCorrect);
 
        answers.forEach(answer => {
            const normalizedAnswerLetter = answer.letter.replace(/[^A-D]/gi, '').trim().toUpperCase();
 
            if (normalizedAnswerLetter === normalizedCorrect) {
                const labelDiv = answer.element.querySelector('.label');
                if (labelDiv) {
                    labelDiv.style.color = '#1e7e34';
                    labelDiv.style.fontWeight = '600';
                }
 
                log(`Highlighted answer ${answer.letter}`);
            }
        });
    }
 
    async function processQuiz() {
        if (isProcessing) return;
 
        if (!hasQuizContent()) {
            return;
        }
 
        const question = extractQuestion();
        if (!question) {
            return;
        }
 
        if (question === lastQuestionText) {
            return;
        }
 
        log('New question detected');
        lastQuestionText = question;
        isProcessing = true;
 
        removeHighlights();
        showProgress();
 
        try {
            const answers = extractAnswers();
            if (answers.length === 0) {
                log('No answers found');
                hideProgress(false);
                isProcessing = false;
                return;
            }
 
            const images = await extractImages();
            if (images.length > 0) {
                log(`Processed ${images.length} optimized image(s)`);
            }
 
            const correctAnswer = await queryGemini(question, answers, images);
            highlightAnswer(answers, correctAnswer);
            hideProgress(true);
 
        } catch (error) {
            logError('Error:', error.message);
            hideProgress(false);
        } finally {
            isProcessing = false;
        }
    }
 
    function startMonitoring() {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
            console.error('Apex Quiz Auto-Answer: No API key configured. Get one from https://aistudio.google.com/app/apikey');
            return;
        }
 
        log('Apex Quiz Auto-Answer Active');
        log('Images will be resized to max 800x800');
 
        setTimeout(processQuiz, 2000);
 
        const observer = new MutationObserver((mutations) => {
            const relevantChange = mutations.some(mutation => {
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType === 1) {
                        return node.classList?.contains('sia-distractor') ||
                               node.classList?.contains('sia-question-stem') ||
                               node.querySelector?.('.sia-distractor') ||
                               node.querySelector?.('.sia-question-stem');
                    }
                    return false;
                });
            });
 
            if (relevantChange) {
                setTimeout(processQuiz, 500);
            }
        });
 
        const mainContent = document.querySelector('kp-main, main, .sia-content');
        if (mainContent) {
            observer.observe(mainContent, {
                childList: true,
                subtree: true
            });
        }
 
        setInterval(processQuiz, 3000);
    }
 
    function init() {
        startMonitoring();
    }
 
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
 
    // manual trigger: Ctrl+Shift+R
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            lastQuestionText = '';
            isProcessing = false;
            removeHighlights();
            processQuiz();
        }
    });
 
})();