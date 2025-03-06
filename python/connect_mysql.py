import mysql.connector
from mysql.connector import Error

def list_mysql_databases():
    try:
        # 连接到本地MySQL但不指定数据库
        # connection = mysql.connector.connect(
        #     host="localhost",      # 数据库主机地址
        #     port=3306,             # 端口号
        #     user="root",           # 默认用户名，根据实际情况修改
        #     password="6a1nJSdX2BkPDBQ7Ka0eGMiHZfSxkTwc"  # 创建容器时设置的密码
        # )
        connection = mysql.connector.connect(
            host="198.44.169.102",
            port=3306,
            user="deep-research", 
            password="r4PB8N8QAeyyzfkw"
        )
        
        if connection.is_connected():
            db_info = connection.get_server_info()
            print(f"成功连接到MySQL服务器，版本: {db_info}")
            
            # 列出所有数据库
            cursor = connection.cursor()
            cursor.execute("SHOW DATABASES;")
            databases = cursor.fetchall()
            
            print("可用的数据库:")
            for db in databases:
                print(f"- {db[0]}")
            
            cursor.close()
            
    except Error as e:
        print(f"连接MySQL时出错: {e}")
    
    finally:
        if 'connection' in locals() and connection.is_connected():
            connection.close()
            print("MySQL连接已关闭")

if __name__ == "__main__":
    list_mysql_databases()