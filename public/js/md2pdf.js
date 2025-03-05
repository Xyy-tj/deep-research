/**
 * 客户端JavaScript函数 - 发送Markdown内容到API端点并获取PDF文件
 * 
 * @param {string} markdownContent - 要转换的Markdown内容
 * @param {string} [filename="document"] - 下载的PDF文件名(不含扩展名)
 * @param {boolean} [isMacCodeBlock=true] - 是否使用Mac风格的代码块
 * @returns {Promise<void>} - 当PDF下载完成时解析的Promise
 */
async function sendMarkdownToPdfApi(markdownContent, filename = "document", isMacCodeBlock = true) {
    try {
      // 发送POST请求到/md/html端点
      const response = await fetch('/md/html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: markdownContent,
          isMacCodeBlock: isMacCodeBlock
        })
      });
  
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
  
      // 获取响应数据
      const result = await response.blob();
      
      // 创建下载链接并触发下载
      const downloadUrl = URL.createObjectURL(result);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${filename}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 清理URL对象
      URL.revokeObjectURL(downloadUrl);
      
      console.log('PDF转换和下载成功完成');
      return true;
    } catch (error) {
      console.error('转换Markdown为PDF时出错:', error);
      throw error;
    }
  }
  
  /**
   * 上传Markdown文件并转换为PDF
   * 
   * @param {File} markdownFile - Markdown文件对象
   * @param {boolean} [isMacCodeBlock=true] - 是否使用Mac风格的代码块
   * @returns {Promise<void>} - 当PDF下载完成时解析的Promise
   */
  async function uploadMarkdownFileToPdf(markdownFile, isMacCodeBlock = true) {
    try {
      if (!markdownFile || !(markdownFile instanceof File)) {
        throw new Error('请提供有效的Markdown文件');
      }
      
      // 读取文件内容
      const reader = new FileReader();
      const markdownContent = await new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('读取文件失败'));
        reader.readAsText(markdownFile);
      });
      
      // 使用不带扩展名的文件名作为PDF文件名
      const filename = markdownFile.name.replace(/\.[^/.]+$/, "");
      
      // 转换为PDF
      return await sendMarkdownToPdfApi(markdownContent, filename, isMacCodeBlock);
    } catch (error) {
      console.error('转换Markdown文件为PDF时出错:', error);
      throw error;
    }
  }
  
  // 示例使用方法
  // 1. 直接转换Markdown文本
  // sendMarkdownToPdfApi("# 你的Markdown内容", "我的文档");
  
  // 2. 使用文件输入元素上传Markdown文件
  // document.getElementById('markdownFileInput').addEventListener('change', async (event) => {
  //   const file = event.target.files[0];
  //   if (file) {
  //     await uploadMarkdownFileToPdf(file);
  //   }
  // });