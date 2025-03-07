import { useState } from 'react';
import { Button, Row, Col, Space, message } from 'antd';
import { CopyOutlined, EyeOutlined } from '@ant-design/icons';
import { MonacoEditor } from './MonacoEditor';

export function JavaScriptFormatter() {
  const [inputValue, setInputValue] = useState('');
  const [outputValue, setOutputValue] = useState('');

  const formatJavaScript = () => {
    try {
      if (!inputValue.trim()) {
        message.warning('请输入需要格式化的JavaScript代码');
        return;
      }
      // 使用Function构造器验证JavaScript语法
      new Function(inputValue);
      // 使用JSON.stringify的格式化特性来格式化代码
      const formatted = inputValue
        .replace(/;\s*/g, ';\n') // 在分号后添加换行
        .replace(/{\s*/g, '{\n  ') // 在左花括号后添加换行和缩进
        .replace(/}\s*/g, '\n}') // 在右花括号前添加换行
        .replace(/,\s*/g, ',\n  ') // 在逗号后添加换行和缩进
        .replace(/\n\s*\n/g, '\n') // 删除多余的空行
        .trim();
      setOutputValue(formatted);
      message.success('格式化成功');
    } catch (error) {
      message.error('格式化失败，请检查JavaScript语法');
    }
  };

  const compressJavaScript = () => {
    try {
      if (!inputValue.trim()) {
        message.warning('请输入需要压缩的JavaScript代码');
        return;
      }
      // 使用Function构造器验证JavaScript语法
      new Function(inputValue);
      // 基本的代码压缩：移除注释、空格和换行
      const compressed = inputValue
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*|\s*\n\s*/g, '$1') // 移除注释和换行
        .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
        .replace(/\s*([\{\}\[\]\(\)\,\;\:\+\-\*\/\%\=\<\>\!\?]|\&\&|\|\|)\s*/g, '$1') // 移除运算符周围的空格
        .trim();
      setOutputValue(compressed);
      message.success('压缩成功');
    } catch (error) {
      message.error('压缩失败，请检查JavaScript语法');
    }
  };

  const clearAll = () => {
    setInputValue('');
    setOutputValue('');
    message.success('已清空');
  };

  const copyOutput = () => {
    if (!outputValue.trim()) {
      message.warning('没有可复制的内容');
      return;
    }
    navigator.clipboard.writeText(outputValue)
      .then(() => message.success('复制成功'))
      .catch(() => message.error('复制失败'));
  };

  const previewJavaScript = () => {
    try {
      if (!outputValue.trim()) {
        message.warning('没有可预览的内容');
        return;
      }
      // 使用Function构造器验证JavaScript语法
      new Function(outputValue);
      const previewWindow = window.open('', '_blank');
      if (previewWindow) {
        previewWindow.document.write(`
          <html>
            <head>
              <title>JavaScript预览</title>
              <style>
                body { 
                  background-color: #1e1e1e;
                  color: #d4d4d4;
                  padding: 20px;
                  font-family: Consolas, Monaco, 'Courier New', monospace;
                  line-height: 1.5;
                  white-space: pre;
                }
              </style>
            </head>
            <body>${outputValue}</body>
          </html>
        `);
        previewWindow.document.close();
      } else {
        message.error('无法打开预览窗口，请检查浏览器设置');
      }
    } catch (error) {
      message.error('预览失败，请检查JavaScript语法');
    }
  };

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24} style={{ marginBottom: '8px' }}>
          <Space size="middle">
            <Button type="primary" onClick={formatJavaScript} size="large">
              <span style={{ marginRight: '4px' }}>🔧</span>
              格式化
            </Button>
            <Button onClick={compressJavaScript} size="large">
              <span style={{ marginRight: '4px' }}>📦</span>
              压缩
            </Button>
            <Button icon={<EyeOutlined />} onClick={previewJavaScript} size="large">
              预览
            </Button>
            <Button icon={<CopyOutlined />} onClick={copyOutput} size="large">
              复制
            </Button>
            <Button onClick={clearAll} size="large">
              <span style={{ marginRight: '4px' }}>🗑️</span>
              清空
            </Button>
          </Space>
        </Col>
        <Col xs={24} md={12}>
          <MonacoEditor
            value={inputValue}
            onChange={(value) => setInputValue(value || '')}
            language="javascript"
            height="500px"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              theme: 'vs-dark'
            }}
          />
        </Col>
        <Col xs={24} md={12}>
          <MonacoEditor
            value={outputValue}
            language="javascript"
            height="500px"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: true,
              theme: 'vs-dark'
            }}
          />
        </Col>
      </Row>
    </div>
  );
}