import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const bcrypt = require('bcryptjs');
export const jwt = require('jsonwebtoken');
export const express = require('express');
export const cors = require('cors');
export const helmet = require('helmet');
export const rateLimit = require('express-rate-limit');
export const exceljs = require('exceljs');
export const puppeteer = require('puppeteer');
