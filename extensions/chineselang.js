/*
 * 中文程 · TurboWarp / Scratch 3.0 图形化编程扩展
 * =============================================================
 * 把「中文程」文本编程语言接入积木式图形化编程环境。
 *
 * 架构：语言内核直接内联在本文件中（由 build.js 自动注入），
 *       因此【零依赖、零服务、可完全离线】，不需要任何本地服务端。
 *
 * 加载方式（三选一）：
 *   1) TurboWarp → 添加扩展 → 自定义扩展 → 「文件」标签 → 选本文件
 *      → 勾选「不使用沙盒运行扩展」→ 确定
 *   2) 同上，但用「粘贴代码」标签，把本文件全部内容粘进去
 *   3) 本地 HTTP 服务：必须监听 localhost 的 8000 端口，
 *      然后填 http://localhost:8000/中文程-TurboWarp扩展.js
 *      （URL 方式只认 localhost:8000 与 extensions.turbowarp.org，
 *        127.0.0.1 和 0.0.0.0 都不行）
 *
 * 为什么必须「不使用沙盒」：画布叠加层、输入弹窗、舞台按钮都要访问
 * 页面 DOM，沙盒里跑在 Worker 中没有 DOM。若误以沙盒方式加载，
 * 扩展仍可注册，纯计算积木照常工作，只有绘图类积木会给出中文提示。
 *
 * @name 中文程
 * @id zhongcheng
 * @description 在积木里直接运行中文程（简体/繁体/拼音三方言），输出与画布映射到舞台
 * @author 中文程
 * @version 1.0.0
 * @license MIT
 */
(function (Scratch) {
  'use strict';

  /* =====================================================================
   * 一、内联语言内核
   * ---------------------------------------------------------------------
   * 内核 5 个文件（dialects / lexer / parser / interpreter / stdlib）
   * 是浏览器全局式脚本，全部自主开发、零第三方依赖、不含任何 Node 专有
   * API（无 require / process / Buffer），因此可以直接放进 IIFE 作用域。
   * 构建时 build.js 会把下面那行 __KERNEL__ 占位注释替换为内核源码。
   * 用独立 IIFE 包住，避免内核里的 toNum / formatValue / SyntaxError
   * 等名字污染扩展作用域。
   * ===================================================================== */
  var Kernel = (function () {
    /* ---------- kernel/dialects.js ---------- */
/* ============================================================
 * 中文程 · 方言词表 (dialects.js)
 * ------------------------------------------------------------
 * 「中文程」语言族的内核只有一个（词法/语法/解释器共享同一套
 * token 体系），不同的中文方言只是把同一批 token 映射成不同
 * 的词。这样"各种各样的编程语言"都能用同一引擎解释运行，
 * 且每一种方言都是中文编程。
 *
 * 注意：本文件中 keywords / builtins 的键与值都是语言表面
 * （用户书写的词），必须保持中文/拼音原样，不得英文化。
 *
 * token 类型说明：
 *   VAR      变量声明           WRITE    输出
 *   IF       如果              ELSE_IF  否则如果
 *   ELSE     否则              WHILE    当
 *   FOR      对于              FUNC     函数
 *   RETURN   返回              TRUE     真
 *   FALSE    假                NULL     空
 *   AND      且                OR       或
 *   NOT      非                CLASS    类
 *   NEW      新建              PROP     属性(类内字段)
 *   METHOD   方法(类内函数)    THIS     本(类内自身引用)
 *   FROM     从                TO       到
 *   IN       在                PLUS     加
 *   MINUS    减                STAR     乘
 *   SLASH    除                MOD      取余
 *   EQ       等于(比较)        NEQ      不等于
 *   GT       大于              LT       小于
 *   GE       大于等于          LE       小于等于
 *   ASGN     赋值(设/令)       READ     读入
 *   CLS      清屏              WAIT     等待
 * ============================================================ */

const DIALECTS = {
  /* ---------- 简体 · 白话文 ---------- */
  zh: {
    name: "简体中文程",
    desc: "用简体白话书写的中文编程语言",
    keywords: {
      "设": "VAR", "令": "VAR", "让": "VAR",
      "写": "WRITE", "打印": "WRITE", "输出": "WRITE",
      "如果": "IF", "否则如果": "ELSE_IF", "否则": "ELSE",
      "当": "WHILE", "循环": "WHILE", "永远": "WHILE", "跳出": "BREAK",
      "对于": "FOR", "遍历": "FOR",
      "函数": "FUNC", "定义": "FUNC",
      "返回": "RETURN", "回": "RETURN",
      "真": "TRUE", "假": "FALSE", "空": "NULL", "无": "NULL",
      "且": "AND", "并且": "AND", "或": "OR", "或者": "OR",
      "非": "NOT", "不": "NOT",
      "类": "CLASS", "新建": "NEW", "实例化": "NEW",
      "属性": "PROP", "字段": "PROP",
      "方法": "METHOD", "行为": "METHOD",
      "本": "THIS",
      "从": "FROM", "到": "TO", "在": "IN", "中": "IN",
      "加": "PLUS", "减": "MINUS", "乘": "STAR", "除": "SLASH", "取余": "MOD", "模": "MOD",
      "等于": "EQ", "不等于": "NEQ", "大于": "GT", "小于": "LT",
      "大于等于": "GE", "不小于": "GE", "小于等于": "LE", "不大于": "LE",
      "赋值": "ASGN",
      "读入": "READ", "输入": "READ",
      "清屏": "CLS",
      "等待": "WAIT", "延时": "WAIT"
    },
    builtins: {  // 标准库函数（中文名）
      "长度": "长度", "类型": "类型", "转文本": "转文本", "转数字": "转数字",
      "取整": "取整", "绝对值": "绝对值", "平方根": "平方根", "幂": "幂",
      "随机数": "随机数", "当前时间": "当前时间", "清空画布": "清空画布",
      "画布": "画布", "画点": "画点", "画线": "画线", "画圆": "画圆",
      "画矩形": "画矩形", "填充色": "填充色", "笔画色": "笔画色",
      "包含": "包含", "替换": "替换", "分割": "分割",
      "追加": "追加", "删除": "删除", "排序": "排序", "反转": "反转",
      "最大": "最大", "最小": "最小", "重复": "重复", "范围": "范围",
      "读文件": "读文件", "写文件": "写文件", "当前目录": "当前目录",
      "欧氏距离": "欧氏距离", "线性回归": "线性回归", "预测": "预测", "最近邻": "最近邻",
      "聚类": "聚类", "建网络": "建网络", "训练网络": "训练网络", "网络预测": "网络预测",
      "弹窗": "弹窗",
      "画弧": "画弧", "写字": "写字", "画多边形": "画多边形",
      "四舍五入": "四舍五入", "整除": "整除",
      "正弦": "正弦", "余弦": "余弦", "正切": "正切", "对数": "对数", "指数": "指数", "圆周率": "圆周率",
      "找位置": "找位置", "截取": "截取", "去空格": "去空格", "大写": "大写", "小写": "小写",
      "求和": "求和", "平均": "平均", "计数": "计数", "位置": "位置", "切片": "切片",
      "键列表": "键列表", "值列表": "值列表",
      "解析Json": "解析Json", "生成Json": "生成Json",
      "解析Jso": "解析Json", "生成Jso": "生成Json",
      "解析Js": "解析Json", "生成Js": "生成Json",
      "解析JSON": "解析Json", "生成JSON": "生成Json",
      "时间戳": "时间戳", "选择按钮": "选择按钮", "验证": "验证",
      "系统": "系统", "网络": "网络", "设备": "设备", "家居": "家居", "服务": "服务"
    }
  },

  /* ---------- 繁体 · 文言风 ---------- */
  trad: {
    name: "繁体中文程",
    desc: "用繁体汉字书写的中文编程语言",
    keywords: {
      "設": "VAR", "令": "VAR", "讓": "VAR",
      "寫": "WRITE", "列印": "WRITE", "輸出": "WRITE",
      "如果": "IF", "否則如果": "ELSE_IF", "否則": "ELSE",
      "當": "WHILE", "循環": "WHILE", "永遠": "WHILE", "跳出": "BREAK",
      "對於": "FOR", "遍歷": "FOR",
      "函式": "FUNC", "定義": "FUNC",
      "回傳": "RETURN",
      "真": "TRUE", "假": "FALSE", "空": "NULL", "無": "NULL",
      "且": "AND", "並且": "AND", "或": "OR", "或者": "OR",
      "非": "NOT", "不": "NOT",
      "類": "CLASS", "新建": "NEW", "實例化": "NEW",
      "屬性": "PROP", "欄位": "PROP",
      "方法": "METHOD", "行為": "METHOD",
      "本": "THIS",
      "從": "FROM", "到": "TO", "在": "IN", "中": "IN",
      "加": "PLUS", "減": "MINUS", "乘": "STAR", "除": "SLASH", "取餘": "MOD", "模": "MOD",
      "等於": "EQ", "不等於": "NEQ", "大於": "GT", "小於": "LT",
      "大於等於": "GE", "不小於": "GE", "小於等於": "LE", "不大於": "LE",
      "賦值": "ASGN",
      "讀入": "READ", "輸入": "READ",
      "清屏": "CLS",
      "等待": "WAIT", "延時": "WAIT"
    },
    builtins: {
      "長度": "长度", "類型": "类型", "轉文本": "转文本", "轉數字": "转数字",
      "取整": "取整", "絕對值": "绝对值", "平方根": "平方根", "冪": "幂",
      "隨機數": "随机数", "當前時間": "当前时间", "清空畫布": "清空画布",
      "畫布": "画布", "畫點": "画点", "畫線": "画线", "畫圓": "画圆",
      "畫矩形": "画矩形", "填充色": "填充色", "筆畫色": "笔画色",
      "包含": "包含", "替換": "替换", "分割": "分割",
      "追加": "追加", "刪除": "删除", "排序": "排序", "反轉": "反转",
      "最大": "最大", "最小": "最小", "重複": "重复", "範圍": "范围",
      "讀文件": "读文件", "寫文件": "写文件", "當前目錄": "当前目录",
      "歐氏距離": "欧氏距离", "線性回歸": "线性回归", "預測": "预测", "最近鄰": "最近邻",
      "聚類": "聚类", "建網絡": "建网络", "訓練網絡": "训练网络", "網絡預測": "网络预测",
      "彈窗": "弹窗",
      "畫弧": "画弧", "寫字": "写字", "畫多邊形": "画多边形",
      "四捨五入": "四舍五入", "整除": "整除",
      "正弦": "正弦", "餘弦": "余弦", "正切": "正切", "對數": "对数", "指數": "指数", "圓周率": "圆周率",
      "找位置": "找位置", "截取": "截取", "去空格": "去空格", "大寫": "大写", "小寫": "小写",
      "求和": "求和", "平均": "平均", "計數": "计数", "位置": "位置", "切片": "切片",
      "鍵列表": "键列表", "值列表": "值列表",
      "解析Json": "解析Json", "生成Json": "生成Json",
      "解析Jso": "解析Json", "生成Jso": "生成Json",
      "解析Js": "解析Json", "生成Js": "生成Json",
      "解析JSON": "解析Json", "生成JSON": "生成Json",
      "時間戳": "时间戳", "選擇按鈕": "选择按钮", "驗證": "验证",
      "系統": "系统", "網絡": "网络", "設備": "设备", "家居": "家居", "服務": "服务"
    }
  },

  /* ---------- 拼音 · 注音风 ---------- */
  pinyin: {
    name: "拼音中文程",
    desc: "用汉语拼音书写的中文编程语言",
    keywords: {
      "she": "VAR", "ling": "VAR", "rang": "VAR",
      "xie": "WRITE", "dayin": "WRITE", "shuchu": "WRITE",
      "ruguo": "IF", "fouzeruguo": "ELSE_IF", "fouze": "ELSE",
      "dang": "WHILE", "xunhuan": "WHILE", "yongyuan": "WHILE", "tiaochu": "BREAK",
      "duiyu": "FOR", "bianli": "FOR",
      "hanshu": "FUNC", "dingyi": "FUNC",
      "fanhui": "RETURN", "hui": "RETURN",
      "zhen": "TRUE", "jia": "FALSE", "kong": "NULL", "wu": "NULL",
      "qie": "AND", "bingqie": "AND", "huo": "OR", "huozhe": "OR",
      "fei": "NOT", "bu": "NOT",
      "lei": "CLASS", "xinjian": "NEW", "shilihua": "NEW",
      "shuxing": "PROP", "ziduan": "PROP",
      "fangfa": "METHOD", "xingwei": "METHOD",
      "ben": "THIS",
      "cong": "FROM", "dao": "TO", "zai": "IN", "zhong": "IN",
      "jia": "PLUS", "jian": "MINUS", "cheng": "STAR", "chu": "SLASH", "quyu": "MOD", "mo": "MOD",
      "dengyu": "EQ", "budengyu": "NEQ", "dayu": "GT", "xiaoyu": "LT",
      "dayudengyu": "GE", "buxiaoyu": "GE", "xiaoyudengyu": "LE", "budayu": "LE",
      "fuzhi": "ASGN",
      "duru": "READ", "shuru": "READ",
      "qingping": "CLS",
      "dengdai": "WAIT", "yanshi": "WAIT"
    },
    builtins: {
      "changdu": "长度", "leixing": "类型", "zhuanwenben": "转文本", "zhuanshuzi": "转数字",
      "quzheng": "取整", "jueduizhi": "绝对值", "pingfangen": "平方根", "mi": "幂",
      "suijishu": "随机数", "dangqianshijian": "当前时间", "qingkonghuabu": "清空画布",
      "huabu": "画布", "huadian": "画点", "huaxian": "画线", "huayuan": "画圆",
      "huajuxing": "画矩形", "tianchongse": "填充色", "bihuase": "笔画色",
      "baohan": "包含", "tihuan": "替换", "fenge": "分割",
      "zhuijia": "追加", "zhuiJIA": "追加", "shanchu": "删除", "paixu": "排序", "fanzhuan": "反转",
      "zuida": "最大", "zuixiao": "最小", "chongfu": "重复", "fanwei": "范围",
      "duwenjian": "读文件", "xiewenjian": "写文件", "dangqianmulu": "当前目录",
      "oushijuli": "欧氏距离", "xianxinghuigui": "线性回归", "yuce": "预测", "zuijinlin": "最近邻",
      "julei": "聚类", "jianwangluo": "建网络", "xunlianwangluo": "训练网络", "wangluoyuce": "网络预测",
      "tanchuang": "弹窗",
      "huahu": "画弧", "xiezi": "写字", "huaduobianxing": "画多边形",
      "sishewuru": "四舍五入", "zhengchu": "整除",
      "zhengxian": "正弦", "yuxian": "余弦", "zhengqie": "正切",
      "duishu": "对数", "zhishu": "指数", "yuanzhoulv": "圆周率",
      "zhaoweizhi": "找位置", "jiequ": "截取", "qukongge": "去空格", "daxie": "大写", "xiaoxie": "小写",
      "qiuhe": "求和", "pingjun": "平均", "jishu": "计数", "weizhi": "位置", "qiepian": "切片",
      "jianliebiao": "键列表", "zhiliebiao": "值列表",
      "jiexijson": "解析Json", "shengchengjson": "生成Json",
      "shijianchuo": "时间戳", "xuanzeanniu": "选择按钮", "yanzheng": "验证",
      "xitong": "系统", "wangluo": "网络", "shebei": "设备", "jiaju": "家居", "fuwu": "服务"
    }
  }
};

/* 当前方言（默认简体，可在界面切换） */
let currentDialect = "zh";

function getDialect() {
  return DIALECTS[currentDialect] || DIALECTS.zh;
}

function getDialectName() {
  return getDialect().name;
}


/* ---------- kernel/lexer.js ---------- */
/* ============================================================
 * 中文程 · 词法分析器 (lexer.js)
 * ------------------------------------------------------------
 * 把「中文程」源码拆成 token 流。本分析器不认识任何具体语言，
 * 只根据当前方言的词表把中文/拼音单词映射成统一的 token 类型，
 * 因此同一内核可以驱动简体、繁体、拼音等多种中文语言。
 *
 * token = { type, value, line, column }
 * 类型取值（统一体系）：
 *   NUMBER STRING IDENT | 方言词表映射出的关键词类型 |
 *   PLUS MINUS STAR SLASH MOD ASGN EQ NEQ GT LT GE LE AND OR NOT
 *   LPAREN RPAREN LBRACKET RBRACKET LBRACE RBRACE COMMA SEMI DOT COLON
 *   NL(换行标记) EOF(结束)
 * ============================================================ */

class LexerError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

class Lexer {
  constructor(source, dialect) {
    this.source = source;
    this.keywords = (dialect && dialect.keywords) || DIALECTS.zh.keywords;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    // 最长词优先匹配（如"否则如果"要在"否则"之前匹配）
    this.sortedKeywords = Object.keys(this.keywords).sort((a, b) => b.length - a.length);
  }

  peek() { return this.pos < this.source.length ? this.source[this.pos] : ""; }
  peekNext() { return this.pos + 1 < this.source.length ? this.source[this.pos + 1] : ""; }

  advance(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.pos < this.source.length) {
        if (this.source[this.pos] === "\n") { this.line++; this.column = 1; }
        else { this.column++; }
        this.pos++;
      }
    }
  }

  skipWhitespace() {
    while (this.pos < this.source.length) {
      const c = this.peek();
      if (c === " " || c === "\t" || c === "\r") { this.advance(); }
      else break;
    }
  }

  /* 若当前位置是注释开头则吃掉并返回 {text,line,column}，否则返回 null */
  readComment() {
    const c = this.peek(), n = this.peekNext();
    const line = this.line, column = this.column;
    let text = "";
    if (c === "#" && n === "*") {          // 多行 #* ... *#
      this.advance(2); text = "#*";
      while (this.pos < this.source.length && !(this.peek() === "*" && this.peekNext() === "#")) { text += this.peek(); this.advance(); }
      if (this.pos < this.source.length) { this.advance(2); text += "*#"; }
      return { text, line, column };
    }
    if (c === "/" && n === "*") {          // 多行 /* ... */
      this.advance(2); text = "/*";
      while (this.pos < this.source.length && !(this.peek() === "*" && this.peekNext() === "/")) { text += this.peek(); this.advance(); }
      if (this.pos < this.source.length) { this.advance(2); text += "*/"; }
      return { text, line, column };
    }
    if (c === "#") {                       // 单行 #
      this.advance(); text = "#";
      while (this.pos < this.source.length && this.peek() !== "\n") { text += this.peek(); this.advance(); }
      return { text, line, column };
    }
    if (c === "/" && n === "/") {          // 单行 //
      this.advance(2); text = "//";
      while (this.pos < this.source.length && this.peek() !== "\n") { text += this.peek(); this.advance(); }
      return { text, line, column };
    }
    return null;
  }

  isIdentChar(c) {
    if (!c) return false;
    // 中文、字母、数字、下划线（首字符排除数字由调用处判断）
    return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c) ||
           /[a-zA-Z0-9_]/.test(c);
  }

  isHan(c) { return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(c); }

  tokenize(keepComments = false) {
    const tokens = [];
    while (true) {
      this.skipWhitespace();
      // 吃掉并收集注释（若要求保留）
      while (true) {
        const comment = this.readComment();
        if (!comment) break;
        if (keepComments) tokens.push({ type: "COMMENT", value: comment.text, line: comment.line, column: comment.column });
      }
      if (this.pos >= this.source.length) break;

      const line = this.line, column = this.column;
      const c = this.peek(), n = this.peekNext();

      /* 换行 → NL 标记（作为语句边界） */
      if (c === "\n") { tokens.push({ type: "NL", value: "\n", line, column }); this.advance(); continue; }

      /* 数字 */
      if (/[0-9]/.test(c)) {
        let text = "";
        while (/[0-9]/.test(this.peek())) { text += this.peek(); this.advance(); }
        if (this.peek() === "." && /[0-9]/.test(this.peekNext())) {
          text += "."; this.advance();
          while (/[0-9]/.test(this.peek())) { text += this.peek(); this.advance(); }
        }
        tokens.push({ type: "NUMBER", value: parseFloat(text), line, column });
        continue;
      }

      /* 字符串：双引号 或 单引号 */
      if (c === '"' || c === "'") {
        const quote = c; this.advance();
        let text = "";
        while (this.pos < this.source.length && this.peek() !== quote) {
          if (this.peek() === "\\") {
            this.advance();
            const e = this.peek();
            if (e === "n") text += "\n";
            else if (e === "t") text += "\t";
            else if (e === "r") text += "\r";
            else if (e === "\\") text += "\\";
            else if (e === '"') text += '"';
            else if (e === "'") text += "'";
            else { text += "\\" + e; }
            this.advance();
          } else {
            text += this.peek(); this.advance();
          }
        }
        if (this.pos >= this.source.length) throw new LexerError("字符串未闭合：" + text.slice(0, 12) + "…", line, column);
        this.advance(); // 跳过闭合引号
        tokens.push({ type: "STRING", value: text, line, column });
        continue;
      }

      /* 符号运算符 */
      const symbols = {
        "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH", "%": "MOD",
        "==": "EQ", "!=": "NEQ", ">=": "GE", "<=": "LE", ">": "GT", "<": "LT",
        "&&": "AND", "||": "OR", "!": "NOT", "=": "ASGN",
        "(": "LPAREN", ")": "RPAREN", "[": "LBRACKET", "]": "RBRACKET",
        "{": "LBRACE", "}": "RBRACE", ",": "COMMA", ";": "SEMI", ".": "DOT", ":": "COLON"
      };
      const two = c + n;
      if (symbols[two]) { tokens.push({ type: symbols[two], value: two, line, column }); this.advance(2); continue; }
      if (symbols[c]) { tokens.push({ type: symbols[c], value: c, line, column }); this.advance(); continue; }

      /* 标识符 / 关键词：
       * 先扫描出最大连续的标识符串（汉字/字母/数字/下划线），
       * 再用整串去匹配词表——只有整串都是关键词时才作为关键词，
       * 避免「中间」「jiafa」这类包含关键词字符的普通名称被误拆。 */
      if (this.isHan(c) || /[a-zA-Z_]/.test(c)) {
        let text = "";
        while (this.isIdentChar(this.peek())) { text += this.peek(); this.advance(); }
        if (this.keywords[text]) {
          tokens.push({ type: this.keywords[text], value: text, line, column });
        } else {
          tokens.push({ type: "IDENT", value: text, line, column });
        }
        continue;
      }

      throw new LexerError("无法识别的字符：" + JSON.stringify(c), line, column);
    }
    tokens.push({ type: "EOF", value: null, line: this.line, column: this.column });
    return tokens;
  }
}


/* ---------- kernel/parser.js ---------- */
/* ============================================================
 * 中文程 · 语法分析器 (parser.js)
 * ------------------------------------------------------------
 * 递归下降分析器：把 token 流构造成 AST（抽象语法树）。
 * 同样不认识具体语言——只依据统一的 token 类型，因此三种
 * 方言共享同一语法结构，写出的都是"中文编程"。
 *
 * AST 节点统一用 { type: "…", … } 表示（内部结构，全部英文）：
 *   Program Assign AssignTarget ExprStmt Block Write Read Clear Wait
 *   If While For FuncDecl FuncExpr Return Class Prop Method New
 *   Literal Variable This Binary Unary Call Member Index List Dict
 * ============================================================ */

class SyntaxError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  ahead(k = 1) { return this.tokens[this.pos + k]; }
  advance() { this.pos++; }

  check(type) { return this.peek().type === type; }

  match(type) {
    if (this.check(type)) { const t = this.peek(); this.advance(); return t; }
    return null;
  }

  expect(type, desc) {
    const t = this.match(type);
    if (!t) {
      const cur = this.peek();
      throw new SyntaxError(`此处应为「${desc}」但遇到了「${cur.value !== undefined && cur.value !== null ? cur.value : cur.type}」（第 ${cur.line} 行）`, cur.line, cur.column);
    }
    return t;
  }

  skipNL() {
    while (this.check("NL") || this.check("SEMI")) this.advance();
  }

  /* ---------- 程序 ---------- */
  parseProgram() {
    const stmts = [];
    while (!this.check("EOF")) {
      this.skipNL();
      if (this.check("EOF")) break;
      stmts.push(this.parseStmt());
      this.skipNL();
    }
    return { type: "Program", stmts };
  }

  /* ---------- 语句 ---------- */
  parseStmt() {
    const t = this.peek();
    switch (t.type) {
      case "VAR":   return this.parseVarDecl();
      case "IF":    return this.parseIf();
      case "WHILE": return this.parseWhile();
      case "BREAK": return this.parseBreak();
      case "FOR":   return this.parseFor();
      case "FUNC":  return this.parseFunc();
      case "RETURN":return this.parseReturn();
      case "CLASS": return this.parseClass();
      case "WRITE": return this.parseBuiltinCall("Write");
      case "READ":  return this.parseBuiltinCall("Read");
      case "CLS":   return this.parseBuiltinCall("Clear");
      case "WAIT":  return this.parseBuiltinCall("Wait");
      case "NL":
      case "SEMI":  this.skipNL(); return this.parseStmt();
      default:      return this.parseExprStmt();
    }
  }

  /* 设 x = 表达式  /  设 x  */
  parseVarDecl() {
    const t0 = this.peek();
    this.match("VAR");
    const name = this.expect("IDENT", "变量名").value;
    let value = null;
    if (this.match("ASGN")) value = this.parseExpression();
    return { type: "Assign", name, value, declare: true, line: t0.line, column: t0.column };
  }

  /* x = 表达式  /  本.属性 = 值  /  列表[下标] = 值 */
  parseExprStmt() {
    const t0 = this.peek();
    const expr = this.parseExpression();
    if (this.match("ASGN")) {
      const assignable = expr && (expr.type === "Variable" || expr.type === "Member" || expr.type === "Index");
      if (!assignable) {
        const t = this.peek();
        throw new SyntaxError(`等号左边必须是变量、属性或列表元素（第 ${t.line} 行）`, t.line, t.column);
      }
      const value = this.parseExpression();
      return { type: "AssignTarget", target: expr, value, line: t0.line, column: t0.column };
    }
    if (expr === null) {
      const t = this.peek();
      throw new SyntaxError(`无法理解的语句（第 ${t.line} 行）`, t.line, t.column);
    }
    return { type: "ExprStmt", expr, line: t0.line, column: t0.column };
  }

  /* 如果 (条件) { 体 } 否则如果 (条件) { 体 } … 否则 { 体 } */
  parseIf() {
    const t0 = this.peek();
    this.match("IF");
    const branches = [];
    const cond = this.parseCondExpr();
    branches.push({ cond, body: this.parseBlock() });
    this.skipNL();   // 块结束后的换行也要跳过，否则链式分支断开
    while (this.check("ELSE_IF")) {
      this.match("ELSE_IF");
      const cond2 = this.parseCondExpr();
      branches.push({ cond: cond2, body: this.parseBlock() });
      this.skipNL();
    }
    let elseBody = null;
    if (this.match("ELSE")) elseBody = this.parseBlock();
    return { type: "If", branches, elseBody, line: t0.line, column: t0.column };
  }

  parseCondExpr() {
    this.skipNL();
    const hasParen = !!this.match("LPAREN");
    if (hasParen) this.skipNL();
    const expr = this.parseExpression();
    if (hasParen) {
      this.skipNL();
      this.expect("RPAREN", "右括号）");
    }
    return expr;
  }

  /* 当 (条件) { 体 }   或   永远 { 体 }（省略条件 = 恒真循环，配「跳出」使用） */
  parseWhile() {
    const t0 = this.peek();
    this.match("WHILE");
    this.skipNL();
    const cond = this.check("LBRACE") ? { type: "Literal", value: true } : this.parseCondExpr();
    return { type: "While", cond, body: this.parseBlock(), line: t0.line, column: t0.column };
  }

  /* 跳出（跳出当前循环） */
  parseBreak() {
    const t0 = this.peek();
    this.match("BREAK");
    return { type: "Break", line: t0.line, column: t0.column };
  }

  /* 对于 i 在 列表 { 体 }   或   对于 i 从 1 到 10 { 体 } */
  parseFor() {
    const t0 = this.peek();
    this.match("FOR");
    this.skipNL();
    const varName = this.expect("IDENT", "循环变量名").value;
    this.skipNL();
    if (this.match("IN")) {
      const source = this.parseExpression();
      return { type: "For", varName, source, body: this.parseBlock(), line: t0.line, column: t0.column };
    }
    if (this.match("FROM")) {
      const start = this.parseExpression();
      this.expect("TO", "「到」");
      const end = this.parseExpression();
      return { type: "For", varName, start, end, body: this.parseBlock(), line: t0.line, column: t0.column };
    }
    const t = this.peek();
    throw new SyntaxError(`「对于」后需要「在」或「从…到」（第 ${t.line} 行）`, t.line, t.column);
  }

  /* 函数 名字(参数…) { 体 } */
  parseFunc() {
    const t0 = this.peek();
    this.match("FUNC");
    const name = this.expect("IDENT", "函数名").value;
    this.skipNL();
    this.expect("LPAREN", "（");
    this.skipNL();
    const params = [];
    while (!this.check("RPAREN")) {
      if (this.check("EOF")) throw new SyntaxError("函数参数列表未闭合", this.peek().line, this.peek().column);
      params.push(this.expect("IDENT", "参数名").value);
      if (!this.match("COMMA")) break;
      this.skipNL();
    }
    this.expect("RPAREN", "）");
    this.skipNL();
    const body = this.parseBlock();
    return { type: "FuncDecl", name, params, body, line: t0.line, column: t0.column };
  }

  /* 返回 表达式  /  返回 */
  parseReturn() {
    const t0 = this.peek();
    this.match("RETURN");
    this.skipNL();
    let value = null;
    if (!this.check("NL") && !this.check("EOF") && !this.check("RBRACE") && !this.check("SEMI")) {
      value = this.parseExpression();
    }
    return { type: "Return", value, line: t0.line, column: t0.column };
  }

  /* 类 名字 { 属性 x = …; 方法 f(…) { … } } */
  parseClass() {
    const t0 = this.peek();
    this.match("CLASS");
    const name = this.expect("IDENT", "类名").value;
    this.skipNL();
    this.expect("LBRACE", "｛");
    this.skipNL();
    const members = [];
    while (true) {
      if (this.check("EOF")) throw new SyntaxError("类定义未闭合", this.peek().line, this.peek().column);
      this.skipNL();
      if (this.check("RBRACE")) break;   // 成员结束后的换行要先跳过再判断类结束
      if (this.check("PROP")) {
        this.match("PROP");
        const propName = this.expect("IDENT", "属性名").value;
        let propValue = null;
        if (this.match("ASGN")) propValue = this.parseExpression();
        members.push({ type: "Prop", name: propName, value: propValue });
        this.skipNL();
        continue;
      }
      if (this.check("METHOD") || this.check("FUNC")) {
        this.advance();
        const methodName = this.expect("IDENT", "方法名").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.expect("IDENT", "参数名").value);
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        this.skipNL();
        const body = this.parseBlock();
        members.push({ type: "Method", name: methodName, params, body });
        continue;
      }
      const t = this.peek();
      throw new SyntaxError(`类成员需要以「属性」或「方法」开头（第 ${t.line} 行）`, t.line, t.column);
    }
    this.expect("RBRACE", "｝");
    return { type: "Class", name, members, line: t0.line, column: t0.column };
  }

  /* 块 { 语句… } */
  parseBlock() {
    this.skipNL();
    this.expect("LBRACE", "｛");
    this.skipNL();
    const stmts = [];
    while (!this.check("RBRACE")) {
      if (this.check("EOF")) throw new SyntaxError("语句块未闭合，缺少｝", this.peek().line, this.peek().column);
      stmts.push(this.parseStmt());
      this.skipNL();
    }
    this.expect("RBRACE", "｝");
    return { type: "Block", stmts };
  }

  /* 写(…) 读入(…) 清屏() 等待(…) —— 语句级内置调用 */
  parseBuiltinCall(nodeType) {
    const t0 = this.peek();
    this.advance(); // 吃掉关键词 token
    this.skipNL();
    this.expect("LPAREN", "（");
    this.skipNL();
    const params = [];
    while (!this.check("RPAREN")) {
      if (this.check("EOF")) throw new SyntaxError("调用参数列表未闭合", this.peek().line, this.peek().column);
      params.push(this.parseExpression());
      if (!this.match("COMMA")) break;
      this.skipNL();
    }
    this.expect("RPAREN", "）");
    return { type: nodeType, params, line: t0.line, column: t0.column };
  }

  /* ---------- 表达式 ---------- */

  /* 或 */
  parseExpression() {
    this.skipNL();
    let left = this.parseAnd();
    while (this.check("OR")) {
      this.advance(); this.skipNL();
      const right = this.parseAnd();
      left = { type: "Binary", op: "or", left, right };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.check("AND")) {
      this.advance(); this.skipNL();
      const right = this.parseComparison();
      left = { type: "Binary", op: "and", left, right };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (true) {
      const t = this.peek().type;
      const mapping = { "EQ": "eq", "NEQ": "neq", "GT": "gt", "LT": "lt", "GE": "ge", "LE": "le" };
      if (mapping[t]) {
        this.advance(); this.skipNL();
        const right = this.parseAdditive();
        left = { type: "Binary", op: mapping[t], left, right };
      } else break;
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (true) {
      const t = this.peek().type;
      if (t === "PLUS" || t === "MINUS") {
        this.advance(); this.skipNL();
        const right = this.parseMultiplicative();
        left = { type: "Binary", op: t === "PLUS" ? "add" : "sub", left, right };
      } else break;
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek().type;
      if (t === "STAR" || t === "SLASH" || t === "MOD") {
        this.advance(); this.skipNL();
        const right = this.parseUnary();
        left = { type: "Binary", op: t === "STAR" ? "mul" : t === "SLASH" ? "div" : "mod", left, right };
      } else break;
    }
    return left;
  }

  parseUnary() {
    const t = this.peek().type;
    if (t === "NOT" || t === "MINUS") {
      this.advance(); this.skipNL();
      const operand = this.parseUnary();
      return { type: "Unary", op: t === "NOT" ? "not" : "neg", operand };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expr = this.parseAtom();
    while (true) {
      this.skipNL();
      const t = this.peek().type;
      if (t === "DOT") {
        this.advance();
        const name = this.expect("IDENT", "成员名").value;
        expr = { type: "Member", object: expr, name };
      } else if (t === "LBRACKET") {
        this.advance(); this.skipNL();
        const index = this.parseExpression();
        this.expect("RBRACKET", "】");
        expr = { type: "Index", object: expr, index };
      } else if (t === "LPAREN") {
        this.advance(); this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          if (this.check("EOF")) throw new SyntaxError("调用参数未闭合", this.peek().line, this.peek().column);
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        expr = { type: "Call", target: expr, params };
      } else break;
    }
    return expr;
  }

  parseAtom() {
    this.skipNL();
    const t = this.peek();
    switch (t.type) {
      case "NUMBER": this.advance(); return { type: "Literal", value: t.value };
      case "STRING": this.advance(); return { type: "Literal", value: t.value };
      case "TRUE":  this.advance(); return { type: "Literal", value: true };
      case "FALSE": this.advance(); return { type: "Literal", value: false };
      case "NULL":  this.advance(); return { type: "Literal", value: null };
      case "THIS":  this.advance(); return { type: "This" };
      case "IDENT": {
        this.advance();
        return { type: "Variable", name: t.value };
      }
      case "LPAREN": {
        this.advance(); this.skipNL();
        const expr = this.parseExpression();
        this.skipNL();
        this.expect("RPAREN", "）");
        return expr;
      }
      case "LBRACKET": {
        this.advance(); this.skipNL();
        const elements = [];
        while (!this.check("RBRACKET")) {
          if (this.check("EOF")) throw new SyntaxError("列表未闭合", this.peek().line, this.peek().column);
          elements.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RBRACKET", "】");
        return { type: "List", elements };
      }
      case "LBRACE": {
        this.advance(); this.skipNL();
        const pairs = [];
        while (!this.check("RBRACE")) {
          if (this.check("EOF")) throw new SyntaxError("字典未闭合", this.peek().line, this.peek().column);
          let key;
          if (this.check("STRING")) key = this.match("STRING").value;
          else if (this.check("IDENT")) key = this.match("IDENT").value;
          else {
            const tt = this.peek();
            throw new SyntaxError(`字典键应为文本或名称（第 ${tt.line} 行）`, tt.line, tt.column);
          }
          this.skipNL();
          this.expect("COLON", "：");
          this.skipNL();
          const value = this.parseExpression();
          pairs.push({ key, value });
          this.skipNL();
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RBRACE", "｝");
        return { type: "Dict", pairs };
      }
      case "NEW": {
        this.advance();
        const className = this.expect("IDENT", "类名").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        return { type: "New", className, params };
      }
      case "READ":
      case "CLS":
      case "WAIT":
      case "WRITE": {
        // 内置调用也可作为表达式（如：设 猜测 = 读入("…")）
        const type = t.type === "READ" ? "Read" : t.type === "CLS" ? "Clear" : t.type === "WAIT" ? "Wait" : "Write";
        this.advance(); this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          if (this.check("EOF")) throw new SyntaxError("调用参数未闭合", this.peek().line, this.peek().column);
          params.push(this.parseExpression());
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        return { type, params, line: t.line, column: t.column };
      }
      case "FUNC": {
        // 函数表达式（可作值传递）：函数 (参数) { 体 } 或 函数 名字(参数) { 体 }
        const start = this.peek();
        this.advance();
        let funcName = null;
        if (this.check("IDENT")) funcName = this.match("IDENT").value;
        this.skipNL();
        this.expect("LPAREN", "（");
        this.skipNL();
        const params = [];
        while (!this.check("RPAREN")) {
          params.push(this.expect("IDENT", "参数名").value);
          if (!this.match("COMMA")) break;
          this.skipNL();
        }
        this.expect("RPAREN", "）");
        this.skipNL();
        const body = this.parseBlock();
        return { type: "FuncExpr", name: funcName, params, body, line: start.line, column: start.column };
      }
      default: {
        return null;
      }
    }
  }
}

function parseSource(source, dialect) {
  const lexer = new Lexer(source, dialect);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parseProgram();
}


/* ---------- kernel/interpreter.js ---------- */
/* ============================================================
 * 中文程 · 解释器 (interpreter.js)
 * ------------------------------------------------------------
 * 自研的树遍历（tree-walking）解释器：直接沿着 AST 求值。
 * 采用异步执行模型，保证"等待""读入"等操作不冻结界面，
 * 同时循环过程中随时可响应"停止"命令。
 *
 * 值模型（内部结构一律英文，用户可见的文本仍为中文）：
 *   数字 number / 文本 string / 逻辑 boolean / 空 null
 *   列表 { __type:"list", data:[…] }
 *   字典 { __type:"dict", data:{…} }
 *   函数 { __type:"func", name, params, body, env }   （闭包）
 *   类   { __type:"class", name, props, methods, env }
 *   实例 { __type:"instance", cls, fields }
 * ============================================================ */

class RuntimeError extends Error {
  constructor(message, line, column) {
    super(message);
    this.line = line || 0;
    this.column = column || 0;
  }
}

/* ---------- 环境（作用域链） ---------- */
class Scope {
  constructor(parent) {
    this.vars = new Map();
    this.parent = parent || null;
  }

  define(name, value) { this.vars.set(name, value); }

  find(name) {
    let scope = this;
    while (scope) {
      if (scope.vars.has(name)) return scope;
      scope = scope.parent;
    }
    return null;
  }

  get(name) {
    const scope = this.find(name);
    if (!scope) throw new RuntimeError(`未定义的名称：「${name}」。需要先「设」一下，或者检查拼写。`);
    return scope.vars.get(name);
  }

  assign(name, value) {
    const scope = this.find(name);
    if (scope) { scope.vars.set(name, value); return; }
    // 未声明时自动定义（宽容模式，方便初学者）
    this.vars.set(name, value);
  }
}

/* ---------- 解释器 ---------- */
class Interpreter {
  constructor(host) {
    this.host = host;          // 提供 print/input/clear/sleep/canvas/file 等宿主能力
    this.stopped = false;      // 停止标志
    this.curLine = 0;
    this.curColumn = 0;
    this.globals = new Scope();
    this.registerBuiltins();
  }

  /* 记录语句位置，用于错误定位 */
  markPos(node) {
    if (node && node.line) { this.curLine = node.line; this.curColumn = node.column; }
  }

  fail(message, node) {
    if (node && node.line) throw new RuntimeError(message, node.line, node.column);
    throw new RuntimeError(message, this.curLine, this.curColumn);
  }

  checkStop() {
    if (this.stopped || (this.host && this.host.stopped)) throw new RuntimeError("程序已被手动停止", this.curLine, this.curColumn);
  }

  yieldTick() { return Promise.resolve(); }

  /* ---------- 入口 ---------- */
  async run(program) {
    this.stopped = false;
    for (const stmt of program.stmts) {
      this.checkStop();
      try { await this.exec(stmt, this.globals); }
      catch (e) { if (e && e.__break) this.fail("「跳出」只能用在循环里"); throw e; }
      await this.yieldTick();
    }
  }

  /* ---------- 语句执行（异步） ---------- */
  async exec(node, env) {
    if (!node) return null;
    this.markPos(node);
    switch (node.type) {
      case "Block": {
        const childEnv = new Scope(env);
        for (const stmt of node.stmts) {
          this.checkStop();
          await this.exec(stmt, childEnv);
          await this.yieldTick();
        }
        return null;
      }
      case "Assign": {
        let value = null;
        if (node.value) value = await this.eval(node.value, env);
        if (node.declare) env.define(node.name, value);
        else env.assign(node.name, value);
        return null;
      }
      case "AssignTarget": {
        const value = await this.eval(node.value, env);
        await this.assignTo(node.target, value, env, node);
        return null;
      }
      case "ExprStmt": {
        await this.eval(node.expr, env);
        return null;
      }
      case "Write": {
        const parts = [];
        for (const arg of node.params) {
          const value = await this.eval(arg, env);
          parts.push(formatValue(value));
        }
        this.host.print(parts.join(" "));
        return null;
      }
      case "Read": {
        let prompt = "";
        if (node.params && node.params.length > 0) {
          const value = await this.eval(node.params[0], env);
          prompt = formatValue(value);
        }
        const result = await this.host.input(prompt);
        return result;
      }
      case "Clear": {
        this.host.clear();
        return null;
      }
      case "Wait": {
        let ms = 1000;
        if (node.params && node.params.length > 0) {
          const value = await this.eval(node.params[0], env);
          ms = toNum(value) || 1000;
        }
        await this.host.sleep(ms);
        return null;
      }
      case "If": {
        for (const branch of node.branches) {
          const cond = await this.eval(branch.cond, env);
          if (truthy(cond)) { await this.exec(branch.body, env); return null; }
        }
        if (node.elseBody) await this.exec(node.elseBody, env);
        return null;
      }
      case "While": {
        while (truthy(await this.eval(node.cond, env))) {
          this.checkStop();
          try { await this.exec(node.body, env); }
          catch (e) { if (e && e.__break) break; throw e; }
          await this.yieldTick();
        }
        return null;
      }
      case "For": {
        const childEnv = new Scope(env);
        if (node.source) {
          const source = await this.eval(node.source, env);
          const iter = iterableOf(source, this);
          for (const element of iter) {
            this.checkStop();
            childEnv.define(node.varName, element);
            try { await this.exec(node.body, childEnv); }
            catch (e) { if (e && e.__break) break; throw e; }
            await this.yieldTick();
          }
        } else {
          const fromVal = await this.eval(node.start, env);
          const toVal = await this.eval(node.end, env);
          const start = Math.floor(toNum(fromVal) || 0);
          const end = Math.floor(toNum(toVal) || 0);
          const step = start <= end ? 1 : -1;
          for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
            this.checkStop();
            childEnv.define(node.varName, i);
            try { await this.exec(node.body, childEnv); }
            catch (e) { if (e && e.__break) break; throw e; }
            await this.yieldTick();
          }
        }
        return null;
      }
      case "Break": {
        throw { __break: true };
      }
      case "FuncDecl": {
        const fnValue = { __type: "func", name: node.name, params: node.params, body: node.body, env };
        env.define(node.name, fnValue);
        return null;
      }
      case "FuncExpr": {
        return { __type: "func", name: node.name || "匿名", params: node.params, body: node.body, env };
      }
      case "Return": {
        let value = null;
        if (node.value) value = await this.eval(node.value, env);
        throw { __return: value };
      }
      case "Class": {
        const props = new Map();
        const methods = new Map();
        for (const member of node.members) {
          if (member.type === "Prop") props.set(member.name, member);
          else if (member.type === "Method") methods.set(member.name, member);
        }
        env.define(node.name, { __type: "class", name: node.name, props, methods, env });
        return null;
      }
      default:
        this.fail(`未知语句类型：${node.type}`, node);
        return null;
    }
  }

  /* ---------- 表达式求值（同步） ---------- */
  async eval(node, env) {
    if (node === null || node === undefined) return null;
    switch (node.type) {
      case "Literal": return node.value;
      case "FuncExpr": {
        return { __type: "func", name: node.name || "匿名", params: node.params, body: node.body, env };
      }
      case "This": {
        const scope = env.find("本");
        if (!scope || !scope.vars.has("本")) this.fail("「本」只能在类的方法内使用", node);
        return scope.vars.get("本");
      }
      case "Variable": {
        return env.get(node.name);
      }
      case "List": {
        const data = [];
        for (const element of node.elements) data.push(await this.eval(element, env));
        return { __type: "list", data };
      }
      case "Dict": {
        const data = {};
        for (const pair of node.pairs) {
          const key = typeof pair.key === "string" ? pair.key : formatValue(pair.key);
          data[key] = await this.eval(pair.value, env);
        }
        return { __type: "dict", data };
      }
      case "New": {
        const clsValue = env.get(node.className);
        if (!clsValue || clsValue.__type !== "class") this.fail(`「${node.className}」不是类，无法新建`, node);
        const instance = { __type: "instance", cls: clsValue, fields: new Map() };
        // 初始化属性默认值
        for (const [name, propNode] of clsValue.props) {
          let value = null;
          if (propNode.value) value = await this.eval(propNode.value, clsValue.env);
          instance.fields.set(name, value);
        }
        // 调用构造方法（方法名约定为「构造」）
        const ctor = clsValue.methods.get("构造");
        if (ctor) {
          const fnValue = { __type: "func", name: "构造", params: ctor.params, body: ctor.body, env: clsValue.env };
          await this.callFunc(fnValue, node.params, env, instance);
        }
        return instance;
      }
      case "Member": {
        const object = await this.eval(node.object, env);
        return getMember(object, node.name, this, node);
      }
      case "Index": {
        const object = await this.eval(node.object, env);
        const index = await this.eval(node.index, env);
        if (object.__type === "list") {
          const i = Math.floor(toNum(index));
          if (i < 0 || i >= object.data.length) this.fail(`列表索引 ${i} 超出范围（长度 ${object.data.length}）`, node);
          return object.data[i];
        }
        if (object.__type === "dict") {
          const key = typeof index === "string" ? index : formatValue(index);
          if (!(key in object.data)) this.fail(`字典中没有键「${key}」`, node);
          return object.data[key];
        }
        if (typeof object === "string") {
          const i = Math.floor(toNum(index));
          if (i < 0 || i >= object.length) this.fail(`文本索引 ${i} 超出范围`, node);
          return object[i];
        }
        this.fail("该值不能按下标访问", node);
        return null;
      }
      case "Unary": {
        const operand = await this.eval(node.operand, env);
        if (node.op === "not") return !truthy(operand);
        if (node.op === "neg") return -(toNum(operand));
        this.fail(`未知一元运算：${node.op}`, node);
        return null;
      }
      case "Binary": {
        const left = await this.eval(node.left, env);
        if (node.op === "and") { if (!truthy(left)) return false; return truthy(await this.eval(node.right, env)); }
        if (node.op === "or") { if (truthy(left)) return true; return truthy(await this.eval(node.right, env)); }
        const right = await this.eval(node.right, env);
        switch (node.op) {
          case "add": return doAdd(left, right, this, node);
          case "sub": return toNum(left) - toNum(right);
          case "mul": return toNum(left) * toNum(right);
          case "div":
            if (toNum(right) === 0) this.fail("除数不能为零", node);
            return toNum(left) / toNum(right);
          case "mod": {
            // 与 Python 内核一致：商向负无穷取整的余数（-7 取余 3 = 2）
            if (toNum(right) === 0) this.fail("取余时除数不能为零", node);
            const a = toNum(left), b = toNum(right);
            return ((a % b) + b) % b;
          }
          case "eq": return isEqual(left, right);
          case "neq": return !isEqual(left, right);
          case "gt": return toNum(left) > toNum(right);
          case "lt": return toNum(left) < toNum(right);
          case "ge": return toNum(left) >= toNum(right);
          case "le": return toNum(left) <= toNum(right);
          default: this.fail(`未知运算：${node.op}`, node);
        }
        return null;
      }
      case "Call": {
        const target = await this.eval(node.target, env);
        return this.callValue(target, node.params, env, node);
      }
      case "Read": {
        let prompt = "";
        if (node.params && node.params.length > 0) {
          prompt = formatValue(await this.eval(node.params[0], env));
        }
        return await this.host.input(prompt);
      }
      case "Clear": {
        this.host.clear();
        return null;
      }
      case "Wait": {
        let ms = 1000;
        if (node.params && node.params.length > 0) {
          ms = toNum(await this.eval(node.params[0], env)) || 1000;
        }
        await this.host.sleep(ms);
        return null;
      }
      case "Write": {
        const parts = [];
        for (const arg of node.params) parts.push(formatValue(await this.eval(arg, env)));
        this.host.print(parts.join(" "));
        return null;
      }
      default:
        this.fail(`未知表达式类型：${node.type}`, node);
        return null;
    }
  }

  /* 调用：函数值 / 成员方法 / 内置函数 */
  async callValue(target, paramNodes, env, node) {
    // 内置函数（JS 函数）
    if (typeof target === "function") {
      const args = [];
      for (const p of paramNodes) args.push(await this.eval(p, env));
      return await target(args, this);
    }
    // 中文程函数
    if (target && target.__type === "func") {
      return this.callFunc(target, paramNodes, env, null);
    }
    // 实例方法（绑定本）
    if (target && target.__type === "boundmethod") {
      return this.callFunc(target.fn, paramNodes, env, target.instance);
    }
    if (target && target.__type === "instance") {
      // 实例被直接调用：若实例是函数对象包装？不支持
      this.fail("实例不能直接调用，请调用它的方法", node);
    }
    this.fail("这里不是一个可以调用的函数", node);
    return null;
  }

  async callFunc(fnValue, paramNodes, env, self) {
    const args = [];
    for (const p of paramNodes) args.push(await this.eval(p, env));
    if (args.length !== fnValue.params.length) {
      this.fail(`函数「${fnValue.name || "匿名"}」需要 ${fnValue.params.length} 个参数，实际给了 ${args.length} 个`);
    }
    const callEnv = new Scope(fnValue.env);
    if (self !== null && self !== undefined) callEnv.define("本", self);
    for (let i = 0; i < fnValue.params.length; i++) callEnv.define(fnValue.params[i], args[i]);
    try {
      await this.exec(fnValue.body, callEnv);
    } catch (e) {
      if (e && e.__return !== undefined) return e.__return;
      throw e;
    }
    return null;
  }

  /* 供宿主事件回调使用：参数已求值好，直接按值调用一个中文程函数（或内置函数） */
  async invokeUserFn(fnValue, args) {
    if (typeof fnValue === "function") return await fnValue(args, this);
    if (fnValue && fnValue.__type === "func") {
      if (args.length !== fnValue.params.length) {
        this.fail(`函数「${fnValue.name || "匿名"}」需要 ${fnValue.params.length} 个参数，实际给了 ${args.length} 个`);
      }
      const callEnv = new Scope(fnValue.env);
      for (let i = 0; i < fnValue.params.length; i++) callEnv.define(fnValue.params[i], args[i]);
      try {
        await this.exec(fnValue.body, callEnv);
      } catch (e) {
        if (e && e.__return !== undefined) return e.__return;
        throw e;
      }
      return null;
    }
    this.fail("这里需要一个函数");
  }

  /* 赋值到：变量 / 成员属性 / 下标元素 */
  async assignTo(target, value, env, node) {
    if (target.type === "Variable") { env.assign(target.name, value); return; }
    const object = await this.eval(target.object, env);
    if (target.type === "Member") {
      if (object.__type === "instance") { object.fields.set(target.name, value); return; }
      if (object.__type === "dict") { object.data[target.name] = value; return; }
      this.fail("该值不能设置成员", node);
    }
    if (target.type === "Index") {
      const index = await this.eval(target.index, env);
      if (object.__type === "list") {
        object.data[Math.floor(toNum(index))] = value;
        return;
      }
      if (object.__type === "dict") { object.data[formatValue(index)] = value; return; }
      this.fail("该值不能按下标赋值", node);
    }
    this.fail("无法赋值的对象", node);
  }

  /* ---------- 内置函数注册 ---------- */
  registerBuiltins() {
    const builtins = builtinTable(this.host);
    for (const [name, fn] of Object.entries(builtins)) {
      this.globals.define(name, fn);
    }
    // 注册当前方言的内建函数别名（繁体「長度」、拼音「changdu」等 → 同一实现），
    // 否则繁体/拼音程序调用这些函数会报「未定义的名称」
    const dialect = typeof getDialect === "function" ? getDialect() : null;
    if (dialect && dialect.builtins) {
      for (const [alias, canonical] of Object.entries(dialect.builtins)) {
        if (builtins[canonical] && !this.globals.vars.has(alias)) this.globals.define(alias, builtins[canonical]);
      }
    }
  }
}

/* ==================== 值工具 ==================== */

function truthy(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (value.__type === "list") return value.data.length > 0;
  if (value.__type === "dict") return Object.keys(value.data).length > 0;
  return true;
}

function toNum(value) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function formatValue(value, depth = 0) {
  if (value === null || value === undefined) return "空";
  if (typeof value === "boolean") return value ? "真" : "假";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "function") return "〈内置函数〉";
  if (value.__type === "list") {
    if (depth > 3) return "[…]";
    return "[" + value.data.map(v => formatValue(v, depth + 1)).join(", ") + "]";
  }
  if (value.__type === "dict") {
    if (depth > 3) return "{…}";
    const entries = Object.entries(value.data).map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`);
    return "{" + entries.join(", ") + "}";
  }
  if (value.__type === "func") return `〈函数 ${value.name || "匿名"}〉`;
  if (value.__type === "class") return `〈类 ${value.name}〉`;
  if (value.__type === "instance") return `〈${value.cls.name} 实例〉`;
  if (value.__type === "boundmethod") return `〈方法 ${value.fn.name}〉`;
  if (value.__type === "device") return `〈设备连接${value.kind ? "·" + value.kind : ""}〉`;
  return String(value);
}

function doAdd(left, right, interp, node) {
  if (typeof left === "string" || typeof right === "string") {
    return formatValue(left) + formatValue(right);
  }
  if (left && left.__type === "list" && right && right.__type === "list") {
    return { __type: "list", data: left.data.concat(right.data) };
  }
  if (typeof left === "number" && typeof right === "number") return left + right;
  return toNum(left) + toNum(right);
}

function isEqual(left, right) {
  if ((left && left.__type === "list") || (right && right.__type === "list") ||
      (left && left.__type === "dict") || (right && right.__type === "dict")) {
    try { return JSON.stringify(normalizeValue(left)) === JSON.stringify(normalizeValue(right)); }
    catch (e) { return left === right; }
  }
  return left === right;
}

function normalizeValue(value) {
  if (value === null) return null;
  if (value.__type === "list") return value.data.map(normalizeValue);
  if (value.__type === "dict") { const o = {}; for (const k in value.data) o[k] = normalizeValue(value.data[k]); return o; }
  return value;
}

function iterableOf(value, interp) {
  if (value.__type === "list") return value.data;
  if (value.__type === "dict") return Object.values(value.data);
  if (typeof value === "string") return value.split("");
  if (typeof value === "number") { const a = []; for (let i = 0; i < value; i++) a.push(i); return a; }
  if (value === null) return [];
  interp.fail("这个值不能用于「在」循环");
  return [];
}

function getMember(object, name, interp, node) {
  if (object.__type === "instance") {
    if (object.fields.has(name)) return object.fields.get(name);
    const methodNode = object.cls.methods.get(name);
    if (methodNode) {
      const fnValue = { __type: "func", name, params: methodNode.params, body: methodNode.body, env: object.cls.env };
      return { __type: "boundmethod", fn: fnValue, instance: object };
    }
    interp.fail(`实例「${object.cls.name}」没有成员「${name}」`, node);
  }
  if (object.__type === "dict") {
    if (name in object.data) return object.data[name];
    interp.fail(`字典中没有键「${name}」`, node);
  }
  if (object.__type === "list") {
    if (name === "长度") return object.data.length;
    interp.fail(`列表没有成员「${name}」`, node);
  }
  interp.fail("该值不能访问成员", node);
  return null;
}


/* ---------- kernel/stdlib.js ---------- */
/* ============================================================
 * 中文程 · 标准库 (stdlib.js)
 * ------------------------------------------------------------
 * 全部为中文命名的内置函数：数学、文本、列表、字典、绘图、
 * 文件、时间等。所有函数由我们自己实现，宿主能力（画布、
 * 文件）通过 host 回调接入界面。
 *
 * 注意：F 上的键名（长度/类型/画点/系统/网络 等）是语言表面，
 * 用户直接书写，必须保持中文；内部实现变量一律英文。
 *
 * 函数约定：fn(参数数组, 解释器) → 返回值
 * ============================================================ */

function builtinTable(host) {
  const F = {};

  /* ---------- 类型与转换 ---------- */
  F.长度 = (p) => {
    const v = p[0];
    if (v && v.__type === "list") return v.data.length;
    if (v && v.__type === "dict") return Object.keys(v.data).length;
    if (typeof v === "string") return v.length;
    if (typeof v === "number") return String(v).length;
    if (v === null) return 0;
    return formatValue(v).length;
  };

  F.类型 = (p) => {
    const v = p[0];
    if (v === null) return "空";
    if (typeof v === "number") return "数字";
    if (typeof v === "string") return "文本";
    if (typeof v === "boolean") return "逻辑";
    if (v.__type === "list") return "列表";
    if (v.__type === "dict") return "字典";
    if (v.__type === "func") return "函数";
    if (v.__type === "class") return "类";
    if (v.__type === "instance") return v.cls.name;
    if (v.__type === "device") return "设备";
    return "未知";
  };

  F.转文本 = (p) => formatValue(p[0]);
  F.转数字 = (p) => {
    const n = parseFloat(formatValue(p[0]));
    return isNaN(n) ? 0 : n;
  };

  /* ---------- 数学 ---------- */
  F.取整 = (p) => Math.floor(toNum(p[0]));
  F.四舍五入 = (p) => Math.round(toNum(p[0]));
  F.整除 = (p, interp) => {
    const b = toNum(p[1]);
    if (b === 0) interp.fail("整除时除数不能为零");
    return Math.trunc(toNum(p[0]) / b);
  };
  F.绝对值 = (p) => Math.abs(toNum(p[0]));
  F.平方根 = (p) => Math.sqrt(toNum(p[0]));
  F.幂 = (p) => Math.pow(toNum(p[0]), toNum(p[1] || 1));
  F.正弦 = (p) => Math.sin(toNum(p[0]));
  F.余弦 = (p) => Math.cos(toNum(p[0]));
  F.正切 = (p) => Math.tan(toNum(p[0]));
  F.对数 = (p) => Math.log(toNum(p[0]));   // 自然对数 ln
  F.指数 = (p) => Math.exp(toNum(p[0]));   // e 的 x 次方
  F.圆周率 = () => Math.PI;
  F.随机数 = (p) => {
    const lo = toNum(p[0] || 0), hi = toNum(p[1] || 0);
    if (lo > hi) return lo;
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  };
  F.最大 = (p) => {
    if (p.length === 1 && p[0] && p[0].__type === "list") {
      if (!p[0].data.length) return 0;
      return Math.max(...p[0].data.map(toNum));
    }
    if (!p.length) return 0;
    return Math.max(...p.map(toNum));
  };
  F.最小 = (p) => {
    if (p.length === 1 && p[0] && p[0].__type === "list") {
      if (!p[0].data.length) return 0;
      return Math.min(...p[0].data.map(toNum));
    }
    if (!p.length) return 0;
    return Math.min(...p.map(toNum));
  };

  /* ---------- 环境 ---------- */
  F.当前目录 = () => (host.currentDir ? host.currentDir() : "");

  /* ---------- 时间 ---------- */
  F.当前时间 = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  F.时间戳 = () => Date.now();   // 毫秒，可用于计时

  /* ---------- 文本 ---------- */
  F.包含 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const part = p[1] === null ? "" : formatValue(p[1]);
    return text.includes(part);
  };
  F.替换 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const oldStr = p[1] === null ? "" : formatValue(p[1]);
    const newStr = p[2] === null ? "" : formatValue(p[2]);
    return text.split(oldStr).join(newStr);
  };
  F.分割 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const sep = p[1] === null || p[1] === undefined ? "" : formatValue(p[1]);
    const parts = text.split(sep);
    return { __type: "list", data: parts };
  };
  F.重复 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const n = Math.max(0, Math.floor(toNum(p[1] || 0)));
    return text.repeat(n);
  };
  F.范围 = (p) => {
    const start = Math.floor(toNum(p[0] || 0));
    const end = Math.floor(toNum(p[1] || 0));
    const data = [];
    for (let i = start; i <= end; i++) data.push(i);
    return { __type: "list", data };
  };
  F.找位置 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    const part = p[1] === null ? "" : formatValue(p[1]);
    return text.indexOf(part);
  };
  F.截取 = (p) => {
    const text = p[0] === null ? "" : formatValue(p[0]);
    return text.slice(Math.floor(toNum(p[1] || 0)), Math.floor(toNum(p[2] === undefined || p[2] === null ? text.length : p[2])));
  };
  F.去空格 = (p) => (p[0] === null ? "" : formatValue(p[0])).trim();
  F.大写 = (p) => (p[0] === null ? "" : formatValue(p[0])).toUpperCase();
  F.小写 = (p) => (p[0] === null ? "" : formatValue(p[0])).toLowerCase();

  /* ---------- 列表 ---------- */
  F.追加 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「追加」的第一个参数必须是列表");
    list.data.push(p[1]);
    return list;
  };
  F.删除 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「删除」的第一个参数必须是列表");
    const i = Math.floor(toNum(p[1]));
    if (i < 0 || i >= list.data.length) interp.fail(`删除的索引 ${i} 超出范围`);
    list.data.splice(i, 1);
    return list;
  };
  F.排序 = (p) => {
    const list = p[0];
    if (!list || list.__type !== "list") return list;
    return { __type: "list", data: list.data.slice().sort((a, b) => toNum(a) - toNum(b)) };
  };
  F.反转 = (p) => {
    const list = p[0];
    if (!list || list.__type !== "list") return list;
    return { __type: "list", data: list.data.slice().reverse() };
  };

  /* 列表参数：传一个列表就展开，否则把所有参数当列表元素（求和(列表) / 求和(1,2,3) 都行） */
  function numItems(p) {
    if (p.length === 1 && p[0] && p[0].__type === "list") return p[0].data.map(toNum);
    return p.map(toNum);
  }
  /* 值是否相等（数字按数字比，其余按文本比） */
  function sameValue(a, b) {
    if (a === b) return true;
    if ((typeof a === "number" || typeof b === "number") && toNum(a) === toNum(b)) return true;
    return formatValue(a) === formatValue(b);
  }
  F.求和 = (p) => numItems(p).reduce((s, n) => s + n, 0);
  F.平均 = (p) => {
    const nums = numItems(p);
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
  };
  F.计数 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「计数」的第一个参数必须是列表");
    return list.data.reduce((c, v) => c + (sameValue(v, p[1]) ? 1 : 0), 0);
  };
  F.位置 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「位置」的第一个参数必须是列表");
    for (let i = 0; i < list.data.length; i++) if (sameValue(list.data[i], p[1])) return i;
    return -1;
  };
  F.切片 = (p, interp) => {
    const list = p[0];
    if (!list || list.__type !== "list") interp.fail("「切片」的第一个参数必须是列表");
    const end = p[2] === undefined || p[2] === null ? list.data.length : Math.floor(toNum(p[2]));
    return { __type: "list", data: list.data.slice(Math.floor(toNum(p[1] || 0)), end) };
  };
  F.键列表 = (p, interp) => {
    const dict = p[0];
    if (!dict || dict.__type !== "dict") interp.fail("「键列表」的参数必须是字典");
    return { __type: "list", data: Object.keys(dict.data) };
  };
  F.值列表 = (p, interp) => {
    const dict = p[0];
    if (!dict || dict.__type !== "dict") interp.fail("「值列表」的参数必须是字典");
    return { __type: "list", data: Object.values(dict.data) };
  };

  /* ---------- JSON（联网 API / IoT 数据必备） ---------- */
  function fromJson(v) {
    if (Array.isArray(v)) return { __type: "list", data: v.map(fromJson) };
    if (v !== null && typeof v === "object") {
      const data = {};
      for (const k in v) data[k] = fromJson(v[k]);
      return { __type: "dict", data };
    }
    return v;
  }
  function toJson(v) {
    if (v && v.__type === "list") return v.data.map(toJson);
    if (v && v.__type === "dict") {
      const o = {};
      for (const k in v.data) o[k] = toJson(v.data[k]);
      return o;
    }
    return v;
  }
  F.解析Json = (p, interp) => {
    try { return fromJson(JSON.parse(formatValue(p[0]))); }
    catch (e) { interp.fail("JSON 解析失败：" + (e && e.message ? e.message : e)); }
  };
  F.生成Json = (p) => JSON.stringify(toJson(p[0]));

  /* ---------- 交互 ---------- */
  F.验证 = (p, interp) => {
    /* 程序自我检验：验证(条件) 或 验证("描述", 条件)，不成立就中文报错 */
    const cond = p.length > 1 ? p[1] : p[0];
    const desc = p.length > 1 ? formatValue(p[0]) : "";
    const ok = cond === true || (typeof cond === "number" && cond !== 0) || (typeof cond === "string" && cond.length > 0);
    if (!ok) interp.fail("验证失败" + (desc ? "：" + desc : ""));
    return null;
  };
  F.选择按钮 = async (p, interp) => {
    const labels = p[0];
    if (!labels || labels.__type !== "list" || !labels.data.length) interp.fail("「选择按钮」需要一个非空的文字列表");
    if (!host.chooseButtons) interp.fail("当前环境不支持「选择按钮」（请在 VSCode 扩展中使用）");
    const text = await host.chooseButtons(labels.data.map(formatValue));
    return text === null || text === undefined ? "" : text;
  };

  /* ---------- 画布绘图 ---------- */
  F.画布 = (p) => host.canvas(toNum(p[0] || 400), toNum(p[1] || 300), formatValue(p[2] || "画布"));
  F.清空画布 = () => host.clearCanvas();
  F.填充色 = (p) => { host.fillColor(formatValue(p[0])); return null; };
  F.笔画色 = (p) => { host.strokeColor(formatValue(p[0])); return null; };
  F.画点 = (p) => { host.drawPoint(toNum(p[0]), toNum(p[1]), toNum(p[2] || 2)); return null; };
  F.画线 = (p) => { host.drawLine(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3])); return null; };
  F.画圆 = (p) => { host.drawCircle(toNum(p[0]), toNum(p[1]), toNum(p[2] || 20)); return null; };
  F.画矩形 = (p) => { host.drawRect(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3])); return null; };
  F.画弧 = (p) => { host.drawArc(toNum(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3]), toNum(p[4]), toNum(p[5])); return null; };
  F.写字 = (p) => { host.drawText(formatValue(p[0]), toNum(p[1]), toNum(p[2]), toNum(p[3] || 14)); return null; };
  F.画多边形 = (p, interp) => {
    const points = p[0];
    if (!points || points.__type !== "list") interp.fail("「画多边形」需要传入坐标点列表");
    const coords = points.data.map(v => { if (v && v.__type === "list") return [toNum(v.data[0]), toNum(v.data[1])]; return [0, 0]; });
    host.drawPolygon(coords);
    return null;
  };

  /* ---------- 文件（通过界面回调，存于宿主本地） ---------- */
  F.读文件 = (p, interp) => {
    const content = host.readFile(formatValue(p[0]));
    if (content === null) interp.fail(`文件「${formatValue(p[0])}」不存在`);
    return content;
  };
  F.写文件 = (p) => { host.writeFile(formatValue(p[0]), formatValue(p[1])); return null; };

  /* ---------- AI 模块（纯内核实现，无需任何依赖，三端可用） ---------- */
  function asNumList(p, i, interp, name) {
    const v = p[i];
    if (!v || v.__type !== "list") interp.fail(`「${name}」第 ${i + 1} 个参数必须是列表`);
    return v.data.map(toNum);
  }

  /* 欧氏距离：两点的直线距离，是最近邻/聚类的基础 */
  F.欧氏距离 = (p, interp) => {
    const a = asNumList(p, 0, interp, "欧氏距离");
    const b = asNumList(p, 1, interp, "欧氏距离");
    let s = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
    return Math.sqrt(s);
  };

  /* 线性回归：从一堆 (x,y) 数据里找出最合适的直线 y = 斜率×x + 截距 */
  F.线性回归 = (p, interp) => {
    const x = asNumList(p, 0, interp, "线性回归");
    const y = asNumList(p, 1, interp, "线性回归");
    if (x.length === 0 || x.length !== y.length) interp.fail("「线性回归」需要两个等长且非空的列表");
    const n = x.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
    const mx = sx / n, my = sy / n;
    let numerator = 0, denominator = 0;
    for (let i = 0; i < n; i++) { numerator += (x[i] - mx) * (y[i] - my); denominator += (x[i] - mx) * (x[i] - mx); }
    const slope = denominator === 0 ? 0 : numerator / denominator;
    return { __type: "dict", data: { "斜率": slope, "截距": my - slope * mx } };
  };

  /* 预测：用线性回归得到的模型算新输入 */
  F.预测 = (p, interp) => {
    const m = p[0];
    if (!m || m.__type !== "dict" || !("斜率" in m.data)) interp.fail("「预测」需要一个由「线性回归」生成的模型");
    return m.data["斜率"] * toNum(p[1]) + m.data["截距"];
  };

  /* 最近邻分类：看新数据点周围 k 个邻居大多是哪一类 */
  F.最近邻 = (p, interp) => {
    const samples = p[0], labels = p[1], target = p[2];
    if (!samples || samples.__type !== "list" || !labels || labels.__type !== "list" || !target || target.__type !== "list")
      interp.fail("「最近邻」需要：样本列表、标签列表、目标点（都是列表）");
    if (samples.data.length === 0 || samples.data.length !== labels.data.length)
      interp.fail("「最近邻」的样本与标签数量必须一致且非空");
    const k = Math.max(1, Math.floor(toNum(p[3] === undefined || p[3] === null ? 1 : p[3])));
    const targetPoint = target.data.map(toNum);
    const distances = samples.data.map((s, i) => {
      const point = (s && s.__type === "list") ? s.data.map(toNum) : [toNum(s)];
      let d = 0;
      const n = Math.min(point.length, targetPoint.length);
      for (let j = 0; j < n; j++) d += (point[j] - targetPoint[j]) * (point[j] - targetPoint[j]);
      return { d: Math.sqrt(d), label: labels.data[i] };
    });
    distances.sort((a, b) => a.d - b.d);
    const topK = distances.slice(0, Math.min(k, distances.length));
    const counts = new Map();
    for (const it of topK) counts.set(String(it.label), (counts.get(String(it.label)) || 0) + 1);
    let bestLabel = null, bestCount = -1;
    for (const [label, c] of counts) if (c > bestCount) { bestCount = c; bestLabel = label; }
    const origin = topK.find(it => String(it.label) === bestLabel);
    return origin ? origin.label : bestLabel;
  };

  /* 聚类（K均值）：自动把数据分成 k 堆，返回 k 个列表 */
  F.聚类 = (p, interp) => {
    const dataset = p[0];
    if (!dataset || dataset.__type !== "list" || dataset.data.length === 0) interp.fail("「聚类」第一个参数必须是非空列表");
    const k = Math.max(1, Math.min(Math.floor(toNum(p[1] === undefined || p[1] === null ? 2 : p[1])), dataset.data.length));
    const rounds = Math.max(1, Math.floor(toNum(p[2] === undefined || p[2] === null ? 30 : p[2])));
    const points = dataset.data.map(s => (s && s.__type === "list") ? s.data.map(toNum) : [toNum(s)]);
    const dim = points[0].length;
    const centers = [];
    for (let c = 0; c < k; c++) centers.push(points[Math.floor(c * points.length / k)].slice());
    const dist2 = (a, b) => { let s = 0; for (let j = 0; j < dim; j++) s += (a[j] - b[j]) * (a[j] - b[j]); return s; };
    let groups = points.map(() => 0);
    for (let round = 0; round < rounds; round++) {
      let changed = false;
      for (let i = 0; i < points.length; i++) {
        let bestC = 0, bestD = Infinity;
        for (let c = 0; c < k; c++) { const d = dist2(points[i], centers[c]); if (d < bestD) { bestD = d; bestC = c; } }
        if (groups[i] !== bestC) { groups[i] = bestC; changed = true; }
      }
      const sums = centers.map(() => new Array(dim).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < points.length; i++) {
        counts[groups[i]]++;
        for (let j = 0; j < dim; j++) sums[groups[i]][j] += points[i][j];
      }
      for (let c = 0; c < k; c++) if (counts[c] > 0) for (let j = 0; j < dim; j++) centers[c][j] = sums[c][j] / counts[c];
      if (!changed) break;
    }
    const result = centers.map(() => ({ __type: "list", data: [] }));
    for (let i = 0; i < points.length; i++) result[groups[i]].data.push(dataset.data[i]);
    return { __type: "list", data: result };
  };

  /* 迷你神经网络：建网络([2,4,1]) → 训练网络(网络, 输入们, 目标们, 轮数, 学习率) → 网络预测(网络, 输入) */
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const pseudoRandom = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return (v - Math.floor(v)) - 0.5; };

  F.建网络 = (p, interp) => {
    const layersArg = p[0];
    if (!layersArg || layersArg.__type !== "list" || layersArg.data.length < 2) interp.fail("「建网络」需要层结构列表，例如 建网络([2, 4, 1])");
    const layers = layersArg.data.map(toNum).map(Math.floor);
    if (layers.some(n => n < 1)) interp.fail("「建网络」每层神经元数量必须不小于 1");
    const weights = [], biases = [];
    for (let l = 1; l < layers.length; l++) {
      const w = [], b = [];
      for (let j = 0; j < layers[l]; j++) {
        const row = [];
        for (let i = 0; i < layers[l - 1]; i++) row.push(pseudoRandom(l * 100 + j, i));
        w.push(row);
        b.push(pseudoRandom(l * 100 + j, 99));
      }
      weights.push(w); biases.push(b);
    }
    return { __type: "dict", data: { "__net": true, "layers": layers.slice(), "weights": weights, "biases": biases } };
  };

  F.训练网络 = (p, interp) => {
    const net = p[0];
    if (!net || net.__type !== "dict" || net.data["__net"] !== true) interp.fail("「训练网络」第一个参数必须是「建网络」生成的网络");
    const inputs = p[1], targets = p[2];
    if (!inputs || inputs.__type !== "list" || !targets || targets.__type !== "list") interp.fail("「训练网络」需要输入列表和目标列表");
    if (inputs.data.length === 0 || inputs.data.length !== targets.data.length) interp.fail("「训练网络」的输入与目标数量必须一致且非空");
    const epochs = Math.max(1, Math.floor(toNum(p[3] === undefined || p[3] === null ? 100 : p[3])));
    const lr = toNum(p[4] === undefined || p[4] === null ? 0.5 : p[4]);
    const W = net.data["weights"], B = net.data["biases"];
    const layerCount = W.length;
    const n = inputs.data.length;
    const expandInput = (v) => (v && v.__type === "list") ? v.data.map(toNum) : [toNum(v)];
    const forward = (input) => {
      const activations = [expandInput(input)];
      for (let l = 0; l < layerCount; l++) {
        const prev = activations[l];
        const next = [];
        for (let j = 0; j < W[l].length; j++) {
          let s = B[l][j];
          for (let i = 0; i < prev.length; i++) s += W[l][j][i] * prev[i];
          next.push(sigmoid(s));
        }
        activations.push(next);
      }
      return activations;
    };
    let totalError = 0;
    for (let epoch = 0; epoch < epochs; epoch++) {
      totalError = 0;
      const gW = W.map(w => w.map(r => r.map(() => 0)));
      const gB = B.map(b => b.map(() => 0));
      for (let s = 0; s < n; s++) {
        const activations = forward(inputs.data[s]);
        const expected = expandInput(targets.data[s]);
        const outputLayer = activations[layerCount];
        let delta = new Array(outputLayer.length);
        for (let j = 0; j < outputLayer.length; j++) {
          const e = outputLayer[j] - (expected[j] !== undefined ? expected[j] : 0);
          totalError += e * e;
          delta[j] = e * outputLayer[j] * (1 - outputLayer[j]);
        }
        for (let l = layerCount - 1; l >= 0; l--) {
          const prev = activations[l];
          const newDelta = l > 0 ? new Array(activations[l].length).fill(0) : null;
          for (let j = 0; j < W[l].length; j++) {
            gB[l][j] += delta[j];
            for (let i = 0; i < prev.length; i++) {
              gW[l][j][i] += delta[j] * prev[i];
              if (newDelta) newDelta[i] += W[l][j][i] * delta[j];
            }
          }
          if (newDelta) for (let i = 0; i < newDelta.length; i++) newDelta[i] *= prev[i] * (1 - prev[i]);
          delta = newDelta;
        }
      }
      for (let l = 0; l < layerCount; l++) {
        for (let j = 0; j < W[l].length; j++) {
          B[l][j] -= lr * gB[l][j] / n;
          for (let i = 0; i < W[l][j].length; i++) W[l][j][i] -= lr * gW[l][j][i] / n;
        }
      }
    }
    return totalError / n;
  };

  F.网络预测 = (p, interp) => {
    const net = p[0];
    if (!net || net.__type !== "dict" || net.data["__net"] !== true) interp.fail("「网络预测」第一个参数必须是「建网络」生成的网络");
    const W = net.data["weights"], B = net.data["biases"];
    let a = (p[1] && p[1].__type === "list") ? p[1].data.map(toNum) : [toNum(p[1])];
    for (let l = 0; l < W.length; l++) {
      const next = [];
      for (let j = 0; j < W[l].length; j++) {
        let s = B[l][j];
        for (let i = 0; i < a.length; i++) s += W[l][j][i] * a[i];
        next.push(sigmoid(s));
      }
      a = next;
    }
    return { __type: "list", data: a };
  };

  /* ---------- 系统模块（宿主能力：VSCode/桌面环境可用，网页沙箱不支持） ---------- */
  const needHost = (interp, name) => interp.fail(`当前环境不支持「${name}」（请在 VSCode 扩展中使用）`);

  /* 弹窗：弹出一个系统提示框（平级函数，方便入门） */
  F.弹窗 = (p, interp) => {
    if (!host.showPopup) needHost(interp, "弹窗");
    host.showPopup(formatValue(p[0]));
    return null;
  };

  F.系统 = {
    __type: "dict",
    data: {
      执行: (p, interp) => {
        if (!host.execCommand) needHost(interp, "系统.执行");
        try { return host.execCommand(formatValue(p[0])); }
        catch (e) { interp.fail("命令执行失败：" + (e && e.message ? e.message : e)); }
      },
      环境变量: (p) => (host.getEnv ? host.getEnv(formatValue(p[0])) : ""),
      目录: () => (host.currentDir ? host.currentDir() : ""),
      弹窗: (p) => { if (host.showPopup) host.showPopup(formatValue(p[0])); return null; },
      打开: (p) => { if (host.openExternal) host.openExternal(formatValue(p[0])); return null; },
    },
  };

  /* ---------- 网络模块（宿主能力：联网请求） ---------- */
  F.网络 = {
    __type: "dict",
    data: {
      请求: async (p, interp) => {
        if (!host.httpGet) needHost(interp, "网络.请求");
        return await host.httpGet(formatValue(p[0]));
      },
      提交: async (p, interp) => {
        if (!host.httpPost) needHost(interp, "网络.提交");
        return await host.httpPost(formatValue(p[0]), p[1] === null || p[1] === undefined ? "" : formatValue(p[1]));
      },
    },
  };

  /* ---------- IoT 设备模块（宿主能力：TCP 直连 + MQTT 消息订阅） ----------
   * 连接句柄是不透明的设备对象（__type:"device"），由宿主创建与管理。
   * MQTT订阅 接收一个中文程函数作为回调：函数(主题, 消息)，
   * 订阅后程序进入"事件模式"，直到调用 MQTT关闭 或按停止。 */
  function asDevice(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device") interp.fail(`「${name}」第 ${i + 1} 个参数必须是设备连接（先用 设备.连接TCP 或 设备.MQTT连接）`);
    return h;
  }

  F.设备 = {
    __type: "dict",
    data: {
      连接TCP: async (p, interp) => {
        if (!host.tcpConnect) needHost(interp, "设备.连接TCP");
        try { return await host.tcpConnect(formatValue(p[0]), toNum(p[1])); }
        catch (e) { interp.fail("TCP 连接失败：" + (e && e.message ? e.message : e)); }
      },
      发送: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.发送");
        try { host.tcpSend(h, formatValue(p[1])); return null; }
        catch (e) { interp.fail("发送失败：" + (e && e.message ? e.message : e)); }
      },
      接收: async (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.接收");
        try { return await host.tcpRecv(h); }
        catch (e) { interp.fail("接收失败：" + (e && e.message ? e.message : e)); }
      },
      关闭: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.关闭");
        try { host.devClose(h); } catch (e) {}
        return null;
      },
      MQTT连接: async (p, interp) => {
        if (!host.mqttConnect) needHost(interp, "设备.MQTT连接");
        try {
          return await host.mqttConnect(
            formatValue(p[0]), toNum(p[1] || 1883),
            p[2] === null || p[2] === undefined ? "" : formatValue(p[2]),
            p[3] === null || p[3] === undefined ? "" : formatValue(p[3])
          );
        } catch (e) { interp.fail("MQTT 连接失败：" + (e && e.message ? e.message : e)); }
      },
      MQTT发布: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT发布");
        try { host.mqttPublish(h, formatValue(p[1]), formatValue(p[2])); return null; }
        catch (e) { interp.fail("MQTT 发布失败：" + (e && e.message ? e.message : e)); }
      },
      MQTT订阅: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT订阅");
        const cb = p[2];
        if ((!cb || cb.__type !== "func") && typeof cb !== "function") interp.fail("「设备.MQTT订阅」第三个参数必须是回调函数：函数(主题, 消息)");
        try {
          host.mqttSubscribe(h, formatValue(p[1]), async (topic, message) => {
            try { await interp.invokeUserFn(cb, [topic, message]); }
            catch (e) { interp.fail("MQTT 回调执行出错：" + (e && e.message ? e.message : e)); }
          });
        } catch (e) { interp.fail("MQTT 订阅失败：" + (e && e.message ? e.message : e)); }
        return null;
      },
      MQTT关闭: (p, interp) => {
        const h = asDevice(p, 0, interp, "设备.MQTT关闭");
        try { host.mqttClose(h); } catch (e) {}
        return null;
      },
    },
  };

  /* ---------- 家居模块（Home Assistant 直连：长期令牌 + REST API） ----------
   * 一行连上家里的 HA：设 家 = 家居.连接HA("http://homeassistant.local:8123", "长期令牌")
   * 之后即可 家居.状态/数值/实体列表 查询，家居.打开/关闭/切换/开灯/关灯/调亮度/服务 控制。
   * 连接句柄同样是设备对象（__type:"device", kind:"ha"），走宿主 httpGet/httpPost（可带请求头）。 */
  function haHandle(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device" || h.kind !== "ha") interp.fail(`「${name}」第 ${i + 1} 个参数必须是家居连接（先用 家居.连接HA）`);
    return h;
  }
  async function haGet(interp, h, apiPath) {
    if (!host.httpGet) needHost(interp, "家居");
    const text = await host.httpGet(h.url + apiPath, { "Authorization": "Bearer " + h.token });
    try { return fromJson(JSON.parse(text)); }
    catch (e) { interp.fail("家居接口返回的数据无法解析（" + apiPath + "），请检查网址与令牌"); }
  }
  async function haPost(interp, h, apiPath, body) {
    if (!host.httpPost) needHost(interp, "家居");
    const text = await host.httpPost(h.url + apiPath, JSON.stringify(body || {}), {
      "Authorization": "Bearer " + h.token, "Content-Type": "application/json",
    });
    try { return fromJson(JSON.parse(text)); }
    catch (e) { interp.fail("家居接口返回的数据无法解析（" + apiPath + "），请检查网址与令牌"); }
  }
  async function haCallService(p, interp, domain, service) {
    const h = haHandle(p, 0, interp, "家居." + service);
    const body = {};
    if (p[1] !== undefined && p[1] !== null && formatValue(p[1]) !== "") body.entity_id = formatValue(p[1]);
    await haPost(interp, h, "/api/services/" + domain + "/" + service, body);
    return null;
  }

  F.家居 = {
    __type: "dict",
    data: {
      /* 连接HA(网址, 长期令牌)：令牌在 HA 网页「个人资料 → 长期访问令牌」创建 */
      连接HA: (p, interp) => {
        const url = formatValue(p[0]).replace(/\/+$/, "");
        const token = formatValue(p[1]);
        if (!url) interp.fail("「家居.连接HA」需要 Home Assistant 网址，例如 http://homeassistant.local:8123");
        if (!token) interp.fail("「家居.连接HA」需要长期访问令牌（在 HA 网页个人资料页最下方创建）");
        return { __type: "device", kind: "ha", url, token };
      },
      /* 状态(连接, 实体)：返回完整状态字典（含 state、attributes 等） */
      状态: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.状态");
        return await haGet(interp, h, "/api/states/" + formatValue(p[1]));
      },
      /* 数值(连接, 实体)：只取状态值并转成数字，例如温度传感器读数 */
      数值: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.数值");
        const st = await haGet(interp, h, "/api/states/" + formatValue(p[1]));
        return toNum(st && st.__type === "dict" ? st.data.state : 0);
      },
      /* 实体列表(连接)：家里全部实体（灯、开关、传感器……） */
      实体列表: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.实体列表");
        return await haGet(interp, h, "/api/states");
      },
      /* 服务(连接, 域, 服务, 实体?)：万能入口，可调用 HA 任意服务 */
      服务: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.服务");
        const body = {};
        if (p[3] !== undefined && p[3] !== null && formatValue(p[3]) !== "") body.entity_id = formatValue(p[3]);
        await haPost(interp, h, "/api/services/" + formatValue(p[1]) + "/" + formatValue(p[2]), body);
        return null;
      },
      /* 常用开关封装：打开/关闭/切换 任意实体；开灯/关灯/调亮度 专用于灯 */
      打开: (p, interp) => haCallService(p, interp, "homeassistant", "turn_on"),
      关闭: (p, interp) => haCallService(p, interp, "homeassistant", "turn_off"),
      切换: (p, interp) => haCallService(p, interp, "homeassistant", "toggle"),
      开灯: (p, interp) => haCallService(p, interp, "light", "turn_on"),
      关灯: (p, interp) => haCallService(p, interp, "light", "turn_off"),
      调亮度: async (p, interp) => {
        const h = haHandle(p, 0, interp, "家居.调亮度");
        const brightness = Math.max(0, Math.min(255, Math.floor(toNum(p[2]))));
        await haPost(interp, h, "/api/services/light/turn_on", { entity_id: formatValue(p[1]), brightness });
        return null;
      },
    },
  };

  /* ---------- 服务模块（自写系统：HTTP 服务端） ----------
   * 用中文程自己开发智能家居中控 / Web 接口 / 设备网关：
   *   设 服 = 服务.开启(8080)
   *   服务.当请求(服, 函数(方式, 路径, 内容) 返回 "<h1>你好</h1>")
   * 浏览器/手机/厂商云平台访问 http://设备IP:8080 即可到达你的函数，
   * 函数返回的文本就是响应内容（网页/JSON 都行）。 */
  function svHandle(p, i, interp, name) {
    const h = p[i];
    if (!h || h.__type !== "device" || h.kind !== "server") interp.fail(`「${name}」第 ${i + 1} 个参数必须是服务句柄（先用 服务.开启）`);
    return h;
  }
  F.服务 = {
    __type: "dict",
    data: {
      /* 开启(端口, 处理函数?)：启动 HTTP 服务；可选直接给处理函数 */
      开启: async (p, interp) => {
        if (!host.httpServerStart) needHost(interp, "服务");
        const port = Math.floor(toNum(p[0] || 8080));
        const h = await host.httpServerStart(port);
        if (p[1] !== undefined && p[1] !== null) F.服务.data.当请求(p, interp);
        return h;
      },
      /* 当请求(服, 函数(方式, 路径, 内容))：函数返回的文本 = 响应内容 */
      当请求: (p, interp) => {
        if (!host.httpServerOn) needHost(interp, "服务");
        const h = svHandle(p, 0, interp, "服务.当请求");
        const fn = p[1];
        if (!fn || (fn.__type !== "func" && typeof fn !== "function")) interp.fail("「服务.当请求」的第二个参数必须是函数，例如 函数(方式, 路径, 内容)");
        host.httpServerOn(h, async (method, pathName, body) => {
          const result = await interp.invokeUserFn(fn, [method, pathName, body]);
          return formatValue(result);
        });
        return null;
      },
      /* 关闭(服)：停止服务并释放端口 */
      关闭: (p, interp) => {
        if (!host.httpServerClose) needHost(interp, "服务");
        const h = svHandle(p, 0, interp, "服务.关闭");
        host.httpServerClose(h);
        return null;
      },
    },
  };

  return F;
}

    return {
      parseSource: parseSource,
      Interpreter: Interpreter,
      Lexer: Lexer,
      DIALECTS: DIALECTS,
      RuntimeError: RuntimeError,
      LexerError: LexerError,
      KernelSyntaxError: SyntaxError,
      setDialect: function (name) { currentDialect = name; },
      getDialectName: getDialectName
    };
  })();

  /* =====================================================================
   * 二、运行环境探测
   * ===================================================================== */
  var runtime = Scratch.vm && Scratch.vm.runtime ? Scratch.vm.runtime : null;
  var hasDom = (typeof document !== 'undefined' && !!document.body);
  var unsandboxed = !!Scratch.extensions.unsandboxed;

  /* 网络请求统一走 Scratch.fetch（TurboWarp 会据此弹出权限确认），
   * 没有该 API 时退回原生 fetch。 */
  var doFetch = Scratch.fetch || (typeof fetch === 'function' ? fetch : null);

  /* =====================================================================
   * 三、中文颜色名 → 色值（与 VSCode 插件画布保持同一套配色）
   * ===================================================================== */
  var COLORS = {
    '纯白': '#ffffff', '白色': '#ffffff', '白': '#ffffff',
    '纯黑': '#000000', '黑色': '#000000', '黑': '#000000',
    '浅天蓝': '#87ceeb', '天蓝': '#87ceeb', '浅蓝': '#8ecae6',
    '天蓝2': '#4fc3f7', '深蓝': '#1a237e', '蓝': '#2196f3',
    '金黄': '#ffd700', '金色': '#ffd700', '黄': '#ffeb3b', '浅黄': '#fff59d',
    '草绿': '#8bc34a', '翠绿': '#00c853', '绿': '#4caf50', '深绿': '#1b5e20',
    '浅绿': '#a5d6a7', '砖红': '#c94f3d', '朱红': '#ff4d00', '大红': '#e53935',
    '红': '#f44336', '深红': '#b71c1c', '粉红': '#f48fb1', '粉': '#f8bbd0',
    '深棕': '#5d4037', '棕': '#795548', '浅棕': '#a1887f',
    '橙': '#ff9800', '浅橙': '#ffcc80', '紫': '#9c27b0', '浅紫': '#ce93d8',
    '青': '#00bcd4', '灰': '#9e9e9e', '浅灰': '#bdbdbd', '深灰': '#616161',
    '银': '#c0c0c0', '米白': '#faf0e6', '奶油': '#fff8dc'
  };

  function resolveColor (name) {
    var text = String(name === null || name === undefined ? '' : name).trim();
    if (COLORS[text]) return COLORS[text];
    if (/^#[0-9a-fA-F]{3,8}$/.test(text) || /^rgba?/i.test(text)) return text;
    return '#333333';
  }

  /* =====================================================================
   * 四、舞台叠加画布
   * ---------------------------------------------------------------------
   * 不复用 Scratch 画笔扩展：画笔扩展并没有 goToXY（那属于 motion），
   * 且画笔状态挂在角色身上、无法画填充图形与文字，还会把用户角色拖走。
   * 这里改为在舞台 canvas 之上叠一层独立 canvas：
   *   · 中文程画布原点在左上、y 向下 —— 与 canvas 2D 原生坐标系完全一致，
   *     不需要任何翻转，绘图保真（矩形/圆/弧/多边形/文字都是真实填充）；
   *   · pointer-events:none，不挡住舞台交互；
   *   · 尺寸跟随舞台 canvas，缩放自适应。
   * ===================================================================== */
  function StageOverlay () {
    this.w = 480;
    this.h = 360;
    this.wrapper = null;
    this.canvas = null;
    this.ctx = null;
    this.fill = '#333333';
    this.stroke = '#000000';
    this.visible = false;
    this.uiHost = null;
    this.uiBox = null;
  }

  StageOverlay.prototype._stageCanvas = function () {
    if (!hasDom) return null;
    if (runtime && runtime.renderer && runtime.renderer.canvas) {
      return runtime.renderer.canvas;
    }
    return document.querySelector('.stage canvas') || document.querySelector('canvas');
  };

  /* 每次绘制前同步位置尺寸，避免窗口缩放后错位 */
  StageOverlay.prototype._sync = function () {
    if (!this.wrapper || !this.canvas) return;
    var stage = this._stageCanvas();
    if (!stage) return;
    var w = stage.offsetWidth || stage.clientWidth;
    var h = stage.offsetHeight || stage.clientHeight;
    if (!w || !h) return;
    this.wrapper.style.left = stage.offsetLeft + 'px';
    this.wrapper.style.top = stage.offsetTop + 'px';
    this.wrapper.style.width = w + 'px';
    this.wrapper.style.height = h + 'px';
  };

  /* 建立（或重建）画布并显示。中文程的 画布(宽, 高) 会调这里 */
  StageOverlay.prototype.show = function (w, h) {
    if (!hasDom || !unsandboxed) return false;
    var stage = this._stageCanvas();
    if (!stage || !stage.parentElement) return false;

    var parent = stage.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    if (!this.wrapper) {
      this.wrapper = document.createElement('div');
      this.wrapper.setAttribute('data-zhongcheng', 'canvas-layer');
      this.wrapper.style.position = 'absolute';
      this.wrapper.style.pointerEvents = 'none';
      this.wrapper.style.zIndex = '9000';
      this.wrapper.style.overflow = 'hidden';
      this.canvas = document.createElement('canvas');
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.wrapper.appendChild(this.canvas);
      parent.appendChild(this.wrapper);
    }

    this.w = Math.max(1, Math.floor(Number(w) || 480));
    this.h = Math.max(1, Math.floor(Number(h) || 360));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.fill = '#333333';
    this.stroke = '#000000';
    this.wrapper.style.display = '';
    this.visible = true;
    this._sync();
    this.clear();
    return true;
  };

  StageOverlay.prototype.hide = function () {
    if (this.wrapper) this.wrapper.style.display = 'none';
    this.visible = false;
  };

  StageOverlay.prototype.clear = function () {
    if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
  };

  StageOverlay.prototype.destroy = function () {
    this._clearUi();
    if (this.uiHost && this.uiHost.parentElement) {
      this.uiHost.parentElement.removeChild(this.uiHost);
    }
    this.uiHost = null;
    if (this.wrapper && this.wrapper.parentElement) {
      this.wrapper.parentElement.removeChild(this.wrapper);
    }
    this.wrapper = null;
    this.canvas = null;
    this.ctx = null;
    this.visible = false;
  };

  StageOverlay.prototype._prepare = function () {
    if (!this.ctx) return null;
    this._sync();
    this.ctx.fillStyle = this.fill;
    this.ctx.strokeStyle = this.stroke;
    return this.ctx;
  };

  /* ---- 图元：语义与 VSCode 插件画布 webview 完全一致 ---- */
  StageOverlay.prototype.point = function (x, y, r) {
    var c = this._prepare();
    if (!c) return;
    c.fillStyle = this.fill;
    c.beginPath();
    c.arc(x, y, Math.max(0.5, r || 2), 0, Math.PI * 2);
    c.fill();
  };

  StageOverlay.prototype.line = function (x1, y1, x2, y2) {
    var c = this._prepare();
    if (!c) return;
    c.strokeStyle = this.stroke;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };

  StageOverlay.prototype.circle = function (x, y, r) {
    var c = this._prepare();
    if (!c) return;
    c.fillStyle = this.fill;
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    c.fill();
  };

  StageOverlay.prototype.rect = function (x, y, w, h) {
    var c = this._prepare();
    if (!c) return;
    c.fillStyle = this.fill;
    c.fillRect(x, y, w, h);
  };

  StageOverlay.prototype.arc = function (x, y, r, start, end, ccw) {
    var c = this._prepare();
    if (!c) return;
    c.fillStyle = this.fill;
    c.beginPath();
    c.arc(x, y, Math.max(0, r),
      (start || 0) * Math.PI / 180,
      (end === undefined || end === null ? 360 : end) * Math.PI / 180,
      !!ccw);
    c.fill();
  };

  StageOverlay.prototype.text = function (str, x, y, size) {
    var c = this._prepare();
    if (!c) return;
    c.fillStyle = this.fill;
    c.font = (size || 14) + "px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    c.textBaseline = 'top';
    c.fillText(String(str), x, y);
  };

  StageOverlay.prototype.polygon = function (coords) {
    var c = this._prepare();
    if (!c || !coords || !coords.length) return;
    c.fillStyle = this.fill;
    c.beginPath();
    c.moveTo(coords[0][0], coords[0][1]);
    for (var i = 1; i < coords.length; i++) c.lineTo(coords[i][0], coords[i][1]);
    c.closePath();
    c.fill();
  };

  /* ---- 交互层：按钮与输入框共用 ----
   * 独立于画布层懒创建，这样「选择按钮」「读入」在没调用过 画布() 时也能工作。 */
  StageOverlay.prototype._ensureUiHost = function () {
    if (!hasDom || !unsandboxed) return null;
    if (this.uiHost && this.uiHost.parentElement) return this.uiHost;

    var stage = this._stageCanvas();
    if (!stage || !stage.parentElement) return null;
    var parent = stage.parentElement;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    var host = document.createElement('div');
    host.setAttribute('data-zhongcheng', 'ui-layer');
    host.style.position = 'absolute';
    host.style.left = stage.offsetLeft + 'px';
    host.style.top = stage.offsetTop + 'px';
    host.style.width = (stage.offsetWidth || stage.clientWidth) + 'px';
    host.style.height = (stage.offsetHeight || stage.clientHeight) + 'px';
    host.style.zIndex = '9100';
    host.style.pointerEvents = 'none';
    host.style.fontFamily = "'Microsoft YaHei', 'PingFang SC', sans-serif";
    parent.appendChild(host);
    this.uiHost = host;
    return host;
  };

  StageOverlay.prototype._clearUi = function () {
    if (this.uiBox && this.uiBox.parentElement) {
      this.uiBox.parentElement.removeChild(this.uiBox);
    }
    this.uiBox = null;
  };

  /* 在交互层里放一个居中的面板（按钮组 / 输入框共用） */
  StageOverlay.prototype._makeUiBox = function () {
    var box = document.createElement('div');
    box.setAttribute('data-zhongcheng', 'ui-box');
    box.style.position = 'absolute';
    box.style.left = '0';
    box.style.top = '0';
    box.style.width = '100%';
    box.style.height = '100%';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.gap = '10px';
    box.style.pointerEvents = 'auto';
    box.style.background = 'rgba(0,0,0,.35)';
    return box;
  };

  /* ---- 选择按钮：在舞台上渲染真实可点按钮，返回被点文字 ---- */
  StageOverlay.prototype._clearButtons = function () {
    this._clearUi();
  };

  StageOverlay.prototype.choose = function (labels) {
    var self = this;
    return new Promise(function (resolve) {
      var items = (labels || []).map(function (v) { return String(v); });
      if (!items.length) { resolve(''); return; }

      var host = self._ensureUiHost();
      /* 没有 DOM（沙盒环境）时退化为返回第一项，保证程序不卡死 */
      if (!host) { resolve(items[0]); return; }

      self._clearUi();
      var box = self._makeUiBox();

      var done = false;
      var finish = function (value) {
        if (done) return;
        done = true;
        self._clearUi();
        resolve(value);
      };

      items.forEach(function (label) {
        var btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = 'padding:8px 18px;font-size:15px;border:none;border-radius:6px;' +
          'background:#2E8B57;color:#fff;cursor:pointer;font-family:inherit;';
        btn.addEventListener('click', function () { finish(label); });
        box.appendChild(btn);
      });

      host.appendChild(box);
      self.uiBox = box;
    });
  };

  /* ---- 舞台内嵌输入框 ----
   * 不用 window.prompt：它会同步冻结整个标签页，
   * 而中文程的 等待()/绘图都在同一线程里，冻结会连带卡死舞台。 */
  StageOverlay.prototype.ask = function (promptText) {
    var self = this;
    return new Promise(function (resolve) {
      var label = String(promptText === undefined || promptText === null ? '请输入：' : promptText);
      var host = self._ensureUiHost();
      if (!host) { resolve(''); return; }

      self._clearUi();
      var box = self._makeUiBox();

      var tip = document.createElement('div');
      tip.textContent = label;
      tip.style.cssText = 'color:#fff;font-size:15px;background:rgba(0,0,0,.55);padding:6px 12px;border-radius:6px;';

      var input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = 'padding:8px 12px;font-size:15px;border:none;border-radius:6px;' +
        'width:220px;max-width:80%;outline:none;font-family:inherit;';

      var btn = document.createElement('button');
      btn.textContent = '确定';
      btn.style.cssText = 'padding:8px 20px;font-size:15px;border:none;border-radius:6px;' +
        'background:#2E8B57;color:#fff;cursor:pointer;font-family:inherit;';

      var done = false;
      var finish = function (value) {
        if (done) return;
        done = true;
        self._clearUi();
        resolve(value);
      };
      btn.addEventListener('click', function () { finish(input.value); });
      input.addEventListener('keydown', function (e) {
        if (e && (e.key === 'Enter' || e.keyCode === 13)) finish(input.value);
      });

      box.appendChild(tip);
      box.appendChild(input);
      box.appendChild(btn);
      host.appendChild(box);
      self.uiBox = box;
      try { input.focus(); } catch (e) { /* 聚焦失败不影响提交 */ }
    });
  };

  /* =====================================================================
   * 五、浏览器宿主
   * ---------------------------------------------------------------------
   * 实现 stdlib.js 需要的 host 回调。浏览器里做不到的能力（系统命令、
   * TCP/MQTT、HTTP 服务端）故意不定义 —— stdlib 的 needHost 会给出
   * 「当前环境不支持「X」（请在 VSCode 扩展中使用）」的中文提示，
   * 属于预期的优雅降级，不会崩溃。
   * ===================================================================== */
  function createHost (state) {
    var overlay = state.overlay;
    var vfs = state.vfs;

    /* 浏览器里的虚拟文件系统：写文件存内存，读文件取内存 */
    var readVfs = function (name) {
      var key = String(name);
      return Object.prototype.hasOwnProperty.call(vfs, key) ? vfs[key] : null;
    };

    var http = function (url, method, body, headers) {
      if (!doFetch) return Promise.reject(new Error('当前环境不支持网络请求'));
      var opts = { method: method || 'GET', headers: headers || {} };
      if (body !== null && body !== undefined) {
        opts.body = String(body);
        if (!opts.headers['Content-Type']) {
          opts.headers['Content-Type'] = 'text/plain; charset=utf-8';
        }
      }
      return doFetch(String(url), opts).then(function (res) {
        if (!res.ok) throw new Error('请求失败：HTTP ' + res.status);
        return res.text();
      });
    };

    return {
      /* 供解释器 checkStop() 读取的中断标志 */
      stopped: false,

      print: function (text) { state.pushOutput(String(text)); },

      input: function (promptText) {
        return overlay.ask(promptText);
      },

      clear: function () { state.clearOutput(); },

      sleep: function (ms) {
        var wait = Math.max(0, Number(ms) || 0);
        return new Promise(function (resolve) { setTimeout(resolve, wait); });
      },

      /* ---- 画布 ---- */
      canvas: function (w, h) {
        if (!overlay.show(w, h)) {
          state.warn('画布不可用：需以「不使用沙盒」方式加载本扩展，绘图指令已跳过');
        }
      },
      clearCanvas: function () { overlay.clear(); },
      fillColor: function (color) { overlay.fill = resolveColor(color); },
      strokeColor: function (color) { overlay.stroke = resolveColor(color); },
      drawPoint: function (x, y, r) { overlay.point(x, y, r); },
      drawLine: function (x1, y1, x2, y2) { overlay.line(x1, y1, x2, y2); },
      drawCircle: function (x, y, r) { overlay.circle(x, y, r); },
      drawRect: function (x, y, w, h) { overlay.rect(x, y, w, h); },
      drawArc: function (x, y, r, start, end, ccw) { overlay.arc(x, y, r, start, end, ccw); },
      drawText: function (str, x, y, size) { overlay.text(str, x, y, size); },
      drawPolygon: function (coords) { overlay.polygon(coords); },

      /* ---- 虚拟文件 ---- */
      readFile: readVfs,
      writeFile: function (name, content) { vfs[String(name)] = String(content); },
      currentDir: function () { return '（浏览器虚拟目录）'; },

      /* ---- 交互与网络 ---- */
      showPopup: function (text) {
        state.pushOutput('【弹窗】 ' + String(text));
      },
      openExternal: function (target) {
        var url = String(target);
        if (Scratch.openWindow) Scratch.openWindow(url);
        else if (hasDom && typeof window !== 'undefined') window.open(url, '_blank');
      },
      httpGet: function (url, headers) { return http(url, 'GET', null, headers); },
      httpPost: function (url, data, headers) { return http(url, 'POST', String(data), headers); },
      chooseButtons: function (labels) { return overlay.choose(labels); },

      /* 浏览器宿主没有常驻监听器，运行完即算空闲 */
      waitIdle: function () { return Promise.resolve(); }
    };
  }

  /* =====================================================================
   * 六、方言识别
   * ===================================================================== */
  var DIALECT_KEYS = ['zh', 'trad', 'pinyin'];

  /* 各方言的关键词集合，用于给 tokenize 结果打分 */
  var DIALECT_KEYWORDS = (function () {
    var out = {};
    DIALECT_KEYS.forEach(function (key) {
      out[key] = {};
      var words = Object.keys((Kernel.DIALECTS[key] || {}).keywords || {});
      words.forEach(function (w) { out[key][w] = true; });
    });
    return out;
  })();

  /* 判定原理：同一段源码分别用三种方言做词法分析。
   * 方言正确时，关键词会被识别成专用 token（WRITE / VAR / IF…）；
   * 方言不对时，这些词会退化成普通标识符 IDENT。
   * 因此「命中本方言关键词表的 token 数」就是该方言的匹配得分，
   * 得分最高者胜出。这比数关键词字面出现次数可靠得多——
   * 因为繁体关键词里含有「如果」这类与简体完全相同的词，
   * 字面计数会让繁体源码同时高分命中简体。 */
  function scoreDialects (source) {
    var code = String(source === null || source === undefined ? '' : source);
    var scores = {};
    DIALECT_KEYS.forEach(function (key) {
      var keywords = DIALECT_KEYWORDS[key];
      var hits = 0;
      try {
        var tokens = new Kernel.Lexer(code, Kernel.DIALECTS[key]).tokenize();
        for (var i = 0; i < tokens.length; i++) {
          var t = tokens[i];
          if (t.type === 'IDENT') continue;             // 没被当作关键词 = 不算分
          if (keywords[String(t.value)]) hits++;
        }
      } catch (e) {
        hits = -1;                                      // 词法直接失败 = 不可能是这种方言
      }
      scores[key] = hits;
    });
    return scores;
  }

  function detectDialect (source) {
    var scores = scoreDialects(source);
    var best = null;
    var bestScore = 0;                                  // 全零得分时保持 best=null → 落到默认简体
    /* 平局时按 pinyin → trad → zh 的优先序，先判定更特异的方言 */
    ['pinyin', 'trad', 'zh'].forEach(function (key) {
      if (scores[key] > bestScore) { bestScore = scores[key]; best = key; }
    });
    return best || 'zh';
  }

  function resolveDialectKey (setting, source) {
    if (setting === '简体' || setting === 'zh') return 'zh';
    if (setting === '繁体' || setting === 'trad') return 'trad';
    if (setting === '拼音' || setting === 'pinyin') return 'pinyin';
    return detectDialect(source);
  }

  /* =====================================================================
   * 七、运行状态与死循环保护
   * ===================================================================== */
  var YIELD_EVERY = 5000;        // 每执行这么多步让出一次事件循环
  var DEFAULT_TIMEOUT_MS = 30000; // 单次运行时间上限

  function RunState () {
    this.overlay = new StageOverlay();
    this.vfs = Object.create(null);
    this.lines = [];
    this.queue = [];
    this.error = '';
    this.ok = false;
    this.running = false;
    this.dialect = '自动';
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
    this.host = createHost(this);
    this.currentInterp = null;
    this.warned = Object.create(null);
  }

  RunState.prototype.pushOutput = function (text) {
    this.lines.push(text);
    this.queue.push(text);
  };

  RunState.prototype.clearOutput = function () {
    this.lines = [];
    this.queue = [];
  };

  /* 同类提示只说一次，避免刷屏 */
  RunState.prototype.warn = function (message) {
    if (this.warned[message]) return;
    this.warned[message] = true;
    this.pushOutput('⚠️ ' + message);
  };

  RunState.prototype.stop = function () {
    this.host.stopped = true;
    if (this.currentInterp) this.currentInterp.stopped = true;
  };

  /* 执行一段中文程源码，返回 { ok, output, error } */
  RunState.prototype.run = function (source, dialectSetting) {
    var self = this;
    var code = String(source === null || source === undefined ? '' : source);

    if (this.running) {
      this.error = '上一次运行还没结束，请先等待或点「停止中文程」';
      return Promise.resolve({ ok: false, output: this.lines.slice(), error: this.error });
    }

    /* 每次运行重置输出与中断标志，但保留虚拟文件（跨次运行持久） */
    this.clearOutput();
    this.error = '';
    this.ok = false;
    this.running = true;
    this.host.stopped = false;
    this.warned = Object.create(null);

    var key = resolveDialectKey(dialectSetting || this.dialect, code);
    var startedAt = Date.now();
    var steps = 0;
    var interp = null;

    try {
      Kernel.setDialect(key);
      var ast = Kernel.parseSource(code, Kernel.DIALECTS[key]);
      interp = new Kernel.Interpreter(this.host);
      this.currentInterp = interp;

      /* 重写让出钩子：既定期交还主线程（保证界面不卡死、
       * 「停止中文程」有机会生效），又实施总时长上限。 */
      interp.yieldTick = function () {
        steps++;
        if (steps % YIELD_EVERY !== 0) return Promise.resolve();
        if (Date.now() - startedAt > self.timeoutMs) {
          interp.stopped = true;
          return new Promise(function (resolve, reject) {
            setTimeout(function () {
              reject(new Error('运行超时（超过 ' + Math.round(self.timeoutMs / 1000) +
                ' 秒），已自动停止。可用「设置运行超时」积木调整上限。'));
            }, 0);
          });
        }
        return new Promise(function (resolve) { setTimeout(resolve, 0); });
      };

      return interp.run(ast)
        .then(function () { return self.host.waitIdle(); })
        .then(function () {
          self.ok = true;
          return self._finish(null);
        })
        .catch(function (e) { return self._finish(e); });
    } catch (e) {
      /* 词法/语法错误在 parseSource 阶段同步抛出 */
      return Promise.resolve(this._finish(e));
    }
  };

  RunState.prototype._finish = function (e) {
    this.running = false;
    this.currentInterp = null;

    if (e) {
      /* 内核用抛 { __return: 值 } 表示顶层「返回」，属正常结束而非错误 */
      if (typeof e === 'object' && '__return' in e) {
        this.ok = true;
        this.error = '';
      } else {
        this.ok = false;
        this.error = formatKernelError(e);
      }
    }
    return { ok: this.ok, output: this.lines.slice(), error: this.error };
  };

  /* 把内核异常翻译成带行号的中文提示（与 VSCode 插件一致） */
  function formatKernelError (e) {
    if (!e) return '未知错误';
    var isKernelError =
      (Kernel.RuntimeError && e instanceof Kernel.RuntimeError) ||
      (Kernel.LexerError && e instanceof Kernel.LexerError) ||
      (Kernel.KernelSyntaxError && e instanceof Kernel.KernelSyntaxError);
    var msg = e.message ? String(e.message) : String(e);
    if (isKernelError && e.line !== undefined && e.line !== null) {
      return '❌ ' + msg + '（第 ' + e.line + ' 行）';
    }
    return '❌ ' + msg;
  }

  /* =====================================================================
   * 八、扩展主体
   * ===================================================================== */
  var BlockType = Scratch.BlockType;
  var ArgumentType = Scratch.ArgumentType;

  var DEMO_CODE = '设 年份 = 2026\n写("你好，中文程！今年是" + 转文本(年份) + "年。")\n对于 i 从 1 到 3 {\n  写("第 " + 转文本(i) + " 次循环")\n}';
  var CANVAS_DEMO = '画布(480, 360)\n填充色("天蓝")\n画矩形(0, 0, 480, 360)\n填充色("金黄")\n画圆(240, 120, 50)\n填充色("草绿")\n画矩形(0, 280, 480, 80)\n写字("中文程 · 图形化编程", 130, 300, 22)';

  function ZhongCheng () {
    this.state = new RunState();
    /* util 只在积木同步执行期间可靠，异步回调里必须用提前存下的引用 */
    this._lastTarget = null;
  }

  ZhongCheng.prototype.getInfo = function () {
    return {
      id: 'zhongcheng',
      name: '中文程',
      color1: '#2E8B57',
      color2: '#1F6B41',
      color3: '#17512F',
      /* 画布叠加层与输入弹窗需要 DOM，必须未沙盒 */
      unsandboxed: true,
      blocks: [
        {
          opcode: 'runCode',
          blockType: BlockType.COMMAND,
          text: '执行中文程 [CODE]',
          arguments: {
            CODE: {
              type: ArgumentType.STRING,
              acceptReporters: true,
              defaultValue: DEMO_CODE
            }
          }
        },
        {
          opcode: 'runCodeCapture',
          blockType: BlockType.REPORTER,
          text: '运行中文程 [CODE] 的输出',
          disableMonitor: true,
          arguments: {
            CODE: { type: ArgumentType.STRING, acceptReporters: true, defaultValue: '写("你好")' }
          }
        },
        { opcode: 'stopCode', blockType: BlockType.COMMAND, text: '停止中文程' },
        {
          opcode: 'setTimeout',
          blockType: BlockType.COMMAND,
          text: '设置运行超时 [SECONDS] 秒',
          arguments: {
            SECONDS: { type: ArgumentType.NUMBER, defaultValue: 30 }
          }
        },
        '---',
        { opcode: 'allOutput', blockType: BlockType.REPORTER, text: '全部输出' },
        { opcode: 'takeOutput', blockType: BlockType.REPORTER, text: '取下一行输出' },
        { opcode: 'outputCount', blockType: BlockType.REPORTER, text: '未读输出行数' },
        { opcode: 'hasOutput', blockType: BlockType.BOOLEAN, text: '还有未读输出' },
        { opcode: 'lastError', blockType: BlockType.REPORTER, text: '最近错误信息' },
        { opcode: 'runOk', blockType: BlockType.BOOLEAN, text: '上次运行成功' },
        { opcode: 'isRunning', blockType: BlockType.BOOLEAN, text: '正在运行' },
        { opcode: 'sayOutput', blockType: BlockType.COMMAND, text: '用角色说出下一行输出' },
        '---',
        {
          opcode: 'setDialect',
          blockType: BlockType.COMMAND,
          text: '设置中文程方言 [DIALECT]',
          arguments: {
            DIALECT: { type: ArgumentType.STRING, menu: 'dialectMenu', defaultValue: '自动' }
          }
        },
        { opcode: 'currentDialect', blockType: BlockType.REPORTER, text: '当前方言' },
        {
          opcode: 'detectDialectOf',
          blockType: BlockType.REPORTER,
          text: '识别这段代码的方言 [CODE]',
          disableMonitor: true,
          arguments: {
            CODE: { type: ArgumentType.STRING, acceptReporters: true, defaultValue: '写("你好")' }
          }
        },
        '---',
        {
          opcode: 'canvas',
          blockType: BlockType.COMMAND,
          text: '中文程画布 宽 [W] 高 [H]',
          arguments: {
            W: { type: ArgumentType.NUMBER, defaultValue: 480 },
            H: { type: ArgumentType.NUMBER, defaultValue: 360 }
          }
        },
        { opcode: 'clearCanvas', blockType: BlockType.COMMAND, text: '清空中文程画布' },
        { opcode: 'hideCanvas', blockType: BlockType.COMMAND, text: '隐藏中文程画布' },
        {
          opcode: 'runCanvasDemo',
          blockType: BlockType.COMMAND,
          text: '运行画布示例'
        },
        '---',
        {
          opcode: 'writeVfs',
          blockType: BlockType.COMMAND,
          text: '写入虚拟文件 [NAME] 内容 [TEXT]',
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: '数据.txt' },
            TEXT: { type: ArgumentType.STRING, acceptReporters: true, defaultValue: '你好' }
          }
        },
        {
          opcode: 'readVfs',
          blockType: BlockType.REPORTER,
          text: '读取虚拟文件 [NAME]',
          disableMonitor: true,
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: '数据.txt' }
          }
        },
        { opcode: 'kernelReady', blockType: BlockType.BOOLEAN, text: '中文程内核已就绪' }
      ],
      menus: {
        dialectMenu: {
          acceptReporters: true,
          items: ['自动', '简体', '繁体', '拼音']
        }
      }
    };
  };

  /* ---------------- 运行类积木 ---------------- */

  ZhongCheng.prototype.runCode = function (args) {
    return this.state.run(args.CODE, this.state.dialect);
  };

  ZhongCheng.prototype.runCodeCapture = function (args) {
    var self = this;
    return this.state.run(args.CODE, this.state.dialect).then(function (result) {
      return result.error ? self.state.lines.join('\n') + '\n' + result.error : result.output.join('\n');
    });
  };

  ZhongCheng.prototype.stopCode = function () {
    this.state.stop();
  };

  ZhongCheng.prototype.setTimeout = function (args) {
    var seconds = Number(args.SECONDS);
    if (!isFinite(seconds) || seconds <= 0) seconds = 30;
    this.state.timeoutMs = Math.min(600000, Math.max(1000, Math.round(seconds * 1000)));
  };

  /* ---------------- 输出类积木 ---------------- */

  ZhongCheng.prototype.allOutput = function () {
    return this.state.lines.join('\n');
  };

  ZhongCheng.prototype.takeOutput = function () {
    return this.state.queue.length ? String(this.state.queue.shift()) : '';
  };

  ZhongCheng.prototype.outputCount = function () {
    return this.state.queue.length;
  };

  /* 未沙盒扩展的布尔积木必须返回真正的 boolean */
  ZhongCheng.prototype.hasOutput = function () {
    return this.state.queue.length > 0;
  };

  ZhongCheng.prototype.lastError = function () {
    return this.state.error || '';
  };

  ZhongCheng.prototype.runOk = function () {
    return !!this.state.ok;
  };

  ZhongCheng.prototype.isRunning = function () {
    return !!this.state.running;
  };

  ZhongCheng.prototype.sayOutput = function (args, util) {
    var line = this.takeOutput();
    /* util 在异步回调中不可靠，先把 target 存下来 */
    var target = util && util.target ? util.target : null;
    /* 舞台（Stage）没有气泡能力，只有角色能说话 */
    if (!target || typeof target.setBubble !== 'function') return Promise.resolve();
    return new Promise(function (resolve) {
      target.setBubble(line, 'say');
      setTimeout(function () {
        target.setBubble('', 'say');
        resolve();
      }, 2000);
    });
  };

  /* ---------------- 方言类积木 ---------------- */

  ZhongCheng.prototype.setDialect = function (args) {
    var value = String(args.DIALECT || '自动');
    this.state.dialect = value;
  };

  ZhongCheng.prototype.currentDialect = function () {
    return this.state.dialect || '自动';
  };

  ZhongCheng.prototype.detectDialectOf = function (args) {
    var key = detectDialect(args.CODE);
    return key === 'trad' ? '繁体' : key === 'pinyin' ? '拼音' : '简体';
  };

  /* ---------------- 画布类积木 ---------------- */

  ZhongCheng.prototype.canvas = function (args) {
    var shown = this.state.overlay.show(args.W, args.H);
    if (!shown) {
      this.state.warn('画布不可用：需以「不使用沙盒」方式加载本扩展');
    }
  };

  ZhongCheng.prototype.clearCanvas = function () {
    this.state.overlay.clear();
  };

  ZhongCheng.prototype.hideCanvas = function () {
    this.state.overlay.hide();
  };

  ZhongCheng.prototype.runCanvasDemo = function () {
    return this.state.run(CANVAS_DEMO, '简体');
  };

  /* ---------------- 虚拟文件类积木 ---------------- */

  ZhongCheng.prototype.writeVfs = function (args) {
    this.state.vfs[String(args.NAME)] = String(args.TEXT);
  };

  ZhongCheng.prototype.readVfs = function (args) {
    var key = String(args.NAME);
    var vfs = this.state.vfs;
    return Object.prototype.hasOwnProperty.call(vfs, key) ? vfs[key] : '';
  };

  /* ---------------- 状态类积木 ---------------- */

  ZhongCheng.prototype.kernelReady = function () {
    return !!(Kernel && Kernel.parseSource && Kernel.Interpreter);
  };

  /* =====================================================================
   * 九、注册
   * ---------------------------------------------------------------------
   * register() 必须且只能调用一次；不调用则 TurboWarp 会一直等待加载。
   * ===================================================================== */
  Scratch.extensions.register(new ZhongCheng());
})(Scratch);
