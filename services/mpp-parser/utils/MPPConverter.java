import net.sf.mpxj.ProjectFile;
import net.sf.mpxj.reader.UniversalProjectReader;
import net.sf.mpxj.Task;
import net.sf.mpxj.Resource;
import net.sf.mpxj.Relation;

import java.io.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class MPPConverter {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("Usage: java MPPConverter <file.mpp>"); System.exit(1); }

        ProjectFile project = new UniversalProjectReader().read(new File(args[0]));
        if (project == null) { System.err.println("Error: Could not parse file"); System.exit(1); }

        StringBuilder j = new StringBuilder("{\n");
        j.append("  \"name\": ").append(q(project.getProjectProperties().getName() != null ? project.getProjectProperties().getName().toString() : "Proyecto Importado")).append(",\n");
        j.append("  \"startDate\": ").append(q(dt(project.getProjectProperties().getStartDate()))).append(",\n");
        j.append("  \"finishDate\": ").append(q(dt(project.getProjectProperties().getFinishDate()))).append(",\n");

        j.append("  \"tasks\": [");
        boolean ft = true;
        for (Task t : project.getChildTasks()) {
            if (!ft) j.append(","); ft = false;
            j.append("\n    {\"uniqueID\":").append(t.getUniqueID())
              .append(",\"id\":").append(t.getID())
              .append(",\"name\":").append(q(s(t.getName())))
              .append(",\"start\":").append(q(dt(t.getStart())))
              .append(",\"finish\":").append(q(dt(t.getFinish())))
              .append(",\"duration\":").append(q(t.getDuration() != null ? t.getDuration().toString() : "PT0H0M0S"))
              .append(",\"percentageComplete\":").append(t.getPercentageComplete() != null ? t.getPercentageComplete() : 0)
              .append(",\"summary\":").append(t.getSummary())
              .append(",\"milestone\":").append(t.getMilestone())
              .append(",\"outlineLevel\":").append(t.getOutlineLevel())
              .append(",\"wbs\":").append(q(s(t.getWBS())))
              .append(",\"predecessorLinks\":[");
            boolean fp = true;
            for (Relation r : t.getPredecessors()) {
                if (!fp) j.append(","); fp = false;
                j.append("{\"predecessorUniqueID\":").append(r.getPredecessorTask().getUniqueID())
                  .append(",\"type\":").append(r.getType() != null ? r.getType().getValue() : 1)
                  .append(",\"linkLag\":").append(r.getLag() != null ? r.getLag().getDuration() : 0)
                  .append(",\"lagFormat\":7}");
            }
            j.append("]}");
        }
        j.append("\n  ],\n");

        j.append("  \"resources\": [");
        boolean fr = true;
        for (Resource r : project.getResources()) {
            if (!fr) j.append(","); fr = false;
            j.append("\n    {\"uniqueID\":").append(r.getUniqueID())
              .append(",\"name\":").append(q(s(r.getName())))
              .append(",\"type\":").append(r.getType() != null ? r.getType().getValue() : 0).append("}");
        }
        j.append("\n  ],\n");
        j.append("  \"calendar\": {\"weekDays\": {}, \"exceptions\": []}\n}");
        System.out.println(j.toString());
    }

    private static String s(Object o) { return o != null ? o.toString() : ""; }
    private static String dt(LocalDateTime d) { return d != null ? d.format(FMT) : ""; }
    private static String q(String v) { return "\"" + (v != null ? v.replace("\\","\\\\").replace("\"","\\\"") : "") + "\""; }
}
