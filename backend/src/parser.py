import sys
import json
import mpxj
import jpype
import os

# Inicializar JVM si no está iniciada (JPype manejo automático con mpxj usualmente, 
# pero importando mpxj ya inicializa el bridge)

def parse_mpp(file_path):
    try:
        if not os.path.exists(file_path):
            raise Exception(f"File not found: {file_path}")

        # Leer archivos con MPXJ (Universal Project Reader)
        reader = mpxj.ProjectReader()
        project = reader.read(file_path)
        
        # Mapear datos a nuestra estructura JSON ideal
        data = {
            "project": {
                "name": str(project.getProjectInfo().getName() or "Sin título"),
                "startDate": str(project.getProjectInfo().getStartDate() or ""),
                "finishDate": str(project.getProjectInfo().getFinishDate() or "")
            },
            "tasks": [],
            "resources": []
        }

        # Extraer Tareas
        for task in project.getTasks():
            # Ignorar tareas nulas o root incompleto
            if task.getID() is None:
                continue

            data["tasks"].append({
                "id": int(task.getID()),
                "wbs": str(task.getWBS() or ""),
                "name": str(task.getName() or ""),
                "start": str(task.getStart() or ""),
                "finish": str(task.getFinish() or ""),
                "duration": str(task.getDuration() or ""), # MPXJ retorna objeto Duration
                "percentComplete": float(task.getPercentageComplete() or 0),
                "isSummary": bool(task.getSummary()),
                "isMilestone": bool(task.getMilestone()),
                "outlineLevel": int(task.getOutlineLevel() or 0)
            })

        # Extraer Recursos
        for res in project.getResources():
            if res.getID() is None:
                continue
            
            data["resources"].append({
                "id": int(res.getID()),
                "name": str(res.getName() or ""),
                "type": 0 # Simplificado por ahora
            })

        print(json.dumps(data, default=str))

    except Exception as e:
        error_response = {
            "error": "PYTHON_PARSER_ERROR",
            "message": str(e)
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    parse_mpp(file_path)
