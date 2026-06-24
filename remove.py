from rembg import remove
from PIL import Image

input_path = r'C:\Users\aryaa\OneDrive\Desktop\projectt\frontend\public\large_robot.png'
output_path = r'C:\Users\aryaa\OneDrive\Desktop\projectt\frontend\public\robot_nobg.png'

input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)
