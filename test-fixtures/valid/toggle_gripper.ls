/PROG  TOGGLE_GRIPPER	  Macro
/ATTR
OWNER		= MNEDITOR;
COMMENT		= "";
PROG_SIZE	= 256;
CREATE		= DATE 25-09-03  TIME 06:52:42;
MODIFIED	= DATE 25-09-03  TIME 06:55:56;
FILE_NAME	= ;
VERSION		= 0;
LINE_COUNT	= 10;
MEMORY_SIZE	= 588;
PROTECT		= READ_WRITE;
TCD:  STACK_SIZE	= 0,
      TASK_PRIORITY	= 50,
      TIME_SLICE	= 0,
      BUSY_LAMP_OFF	= 0,
      ABORT_REQUEST	= 0,
      PAUSE_REQUEST	= 0;
DEFAULT_GROUP	= *,*,*,*,*;
CONTROL_CODE	= 00000000 00000000;
/APPL
/MN
   1:  IF (RI[3:ON :open]) THEN ;
   2:  RO[7:ON :open]=OFF ;
   3:  RO[8:OFF:close]=ON ;
   4:  ELSE ;
   5:  RO[7:ON :open]=ON ;
   6:  RO[8:OFF:close]=OFF ;
   7:  ENDIF ;
   8:   ;
   9:   ;
  10:   ;
/POS
/END
