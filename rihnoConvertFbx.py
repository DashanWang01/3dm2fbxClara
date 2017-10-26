import sys
import os
import re
import rhinoscriptsyntax as rs
    

def SaveAsFBX(filename):
    folder = "C:/Temp/"
    path = os.path.abspath(folder + filename+".fbx")
    cmd = "_-SaveAs " + '\"' + path + '\"' + " _-Enter" + " _-Enter"
    rs.Command(cmd, True)
    return
    #save a file as .fbx

filename=rs.DocumentName()
fileName=re.sub('\.3dm$', '', filename)
SaveAsFBX(fileName)
rs.Exit()
